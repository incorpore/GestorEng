from datetime import timedelta

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.core.crypto import decrypt, encrypt
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.ratelimit import login_limiter, sensitive_limiter
from app.core.registry import registry
from app.core.security import (
    DUMMY_HASH,
    hash_password,
    needs_rehash,
    validate_password_strength,
    verify_password,
)

from . import service
from .models import RefreshToken, Usuario
from .schemas import (
    LoginIn,
    MeOut,
    RefreshIn,
    SessaoOut,
    TokenOut,
    TotpAtivarIn,
    TotpDesativarIn,
    TrocarSenhaIn,
    UsuarioOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
INVALID = "E-mail ou senha inválidos"


@router.post("/login", response_model=TokenOut, dependencies=[Depends(login_limiter)])
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    s = get_settings()
    user = db.scalar(select(Usuario).where(Usuario.email == body.email.lower()))
    if user is None:
        verify_password(body.senha, DUMMY_HASH)
        raise HTTPException(401, INVALID)
    if user.bloqueado_ate and user.bloqueado_ate > service.now():
        raise HTTPException(423, "Usuário temporariamente bloqueado por excesso de tentativas")
    if not verify_password(body.senha, user.password_hash) or not user.ativo:
        user.tentativas_falhas += 1
        if user.tentativas_falhas >= s.login_max_attempts:
            user.bloqueado_ate = service.now() + timedelta(minutes=s.login_lock_minutes)
            user.tentativas_falhas = 0
        audit.log(db, user_id=user.id, action="login_falha", entity="auth", entity_id=user.id, request=request)
        db.commit()
        raise HTTPException(401, INVALID)
    if user.totp_ativo:
        if not body.codigo_totp:
            return TokenOut(totp_required=True)
        secret = decrypt(user.totp_secret or "")
        if not secret or not pyotp.TOTP(secret).verify(body.codigo_totp.strip(), valid_window=1):
            user.tentativas_falhas += 1
            db.commit()
            raise HTTPException(401, "Código de verificação inválido")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.senha)
    user.tentativas_falhas = 0
    user.bloqueado_ate = None
    user.ultimo_login = service.now()
    tokens = service.issue_tokens(db, user, request, response, dispositivo=body.dispositivo)
    audit.log(db, user_id=user.id, action="login", entity="auth", entity_id=user.id, request=request)
    db.commit()
    return TokenOut(**tokens, usuario=UsuarioOut.model_validate(user))


@router.post("/refresh", response_model=TokenOut, dependencies=[Depends(sensitive_limiter)])
def refresh(request: Request, response: Response, body: RefreshIn | None = None, db: Session = Depends(get_db)):
    raw = (body.refresh_token if body else None) or request.cookies.get(service.COOKIE)
    if not raw:
        raise HTTPException(401, "Sessão expirada")
    result = service.rotate(db, raw, request, response)
    if result is None:
        response.delete_cookie(service.COOKIE, path="/api/auth")
        raise HTTPException(401, "Sessão expirada")
    user, tokens = result
    db.commit()
    return TokenOut(**tokens, usuario=UsuarioOut.model_validate(user))


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, body: RefreshIn | None = None, db: Session = Depends(get_db)):
    raw = (body.refresh_token if body else None) or request.cookies.get(service.COOKIE)
    if raw:
        from app.core.security import sha256

        tok = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256(raw)))
        if tok:
            service.revoke_family(db, tok.familia)
            db.commit()
    response.delete_cookie(service.COOKIE, path="/api/auth")


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, response: Response, cu: CurrentUser = Depends(get_current_user),
               db: Session = Depends(get_db)):
    cu.user.token_version += 1
    service.revoke_all(db, cu.id)
    audit.log(db, user_id=cu.id, action="logout_todos", entity="auth", entity_id=cu.id, request=request)
    db.commit()
    response.delete_cookie(service.COOKIE, path="/api/auth")


@router.get("/me", response_model=MeOut)
def me(cu: CurrentUser = Depends(get_current_user)):
    from app.modules import enabled_modules

    perms = cu.perms
    mods = [
        {"key": m.key, "label": m.label, "icon": m.icon, "order": m.order}
        for m in enabled_modules()
        if m.core or cu.user.superusuario or any(p.code in perms for p in m.permissions)
    ]
    return MeOut(usuario=UsuarioOut.model_validate(cu.user), permissoes=sorted(perms), modulos=mods)


@router.post("/trocar-senha", response_model=TokenOut, dependencies=[Depends(sensitive_limiter)])
def trocar_senha(body: TrocarSenhaIn, request: Request, response: Response,
                 cu: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.senha_atual, cu.user.password_hash):
        raise HTTPException(400, "Senha atual incorreta")
    if err := validate_password_strength(body.nova_senha):
        raise HTTPException(422, err)
    if verify_password(body.nova_senha, cu.user.password_hash):
        raise HTTPException(422, "A nova senha deve ser diferente da atual")
    cu.user.password_hash = hash_password(body.nova_senha)
    cu.user.trocar_senha = False
    cu.user.token_version += 1
    service.revoke_all(db, cu.id)
    tokens = service.issue_tokens(db, cu.user, request, response)
    audit.log(db, user_id=cu.id, action="trocar_senha", entity="auth", entity_id=cu.id, request=request)
    db.commit()
    return TokenOut(**tokens, usuario=UsuarioOut.model_validate(cu.user))


@router.post("/2fa/configurar")
def totp_setup(cu: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if cu.user.totp_ativo:
        raise HTTPException(400, "Autenticação em dois fatores já está ativa")
    secret = pyotp.random_base32()
    cu.user.totp_secret = encrypt(secret)
    db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=cu.user.email, issuer_name=get_settings().app_name)
    return {"secret": secret, "otpauth_uri": uri}


@router.post("/2fa/ativar", status_code=204)
def totp_enable(body: TotpAtivarIn, request: Request, cu: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    secret = decrypt(cu.user.totp_secret or "")
    if not secret or not pyotp.TOTP(secret).verify(body.codigo.strip(), valid_window=1):
        raise HTTPException(400, "Código inválido")
    cu.user.totp_ativo = True
    audit.log(db, user_id=cu.id, action="2fa_ativar", entity="auth", entity_id=cu.id, request=request)
    db.commit()


@router.post("/2fa/desativar", status_code=204)
def totp_disable(body: TotpDesativarIn, request: Request, cu: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    if not verify_password(body.senha, cu.user.password_hash):
        raise HTTPException(400, "Senha incorreta")
    cu.user.totp_ativo = False
    cu.user.totp_secret = None
    audit.log(db, user_id=cu.id, action="2fa_desativar", entity="auth", entity_id=cu.id, request=request)
    db.commit()


@router.get("/sessoes", response_model=list[SessaoOut])
def sessoes(cu: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(RefreshToken).where(
            RefreshToken.usuario_id == cu.id,
            RefreshToken.revogado_em.is_(None),
            RefreshToken.usado_em.is_(None),
            RefreshToken.expira_em > service.now(),
        ).order_by(RefreshToken.criado_em.desc())
    ).all()
    return rows


@router.delete("/sessoes/{sessao_id}", status_code=204)
def revogar_sessao(sessao_id: int, cu: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    tok = db.get(RefreshToken, sessao_id)
    if not tok or tok.usuario_id != cu.id:
        raise HTTPException(404, "Sessão não encontrada")
    service.revoke_family(db, tok.familia)
    db.commit()


@router.get("/permissoes")
def catalogo_permissoes(cu: CurrentUser = Depends(get_current_user)):
    """Catálogo de permissões agrupado por módulo (para a tela de perfis)."""
    out = []
    for m in sorted(registry.modules.values(), key=lambda m: m.order):
        if m.permissions:
            out.append({"modulo": m.key, "label": m.label,
                        "permissoes": [{"codigo": p.code, "label": p.label} for p in m.permissions]})
    return out
