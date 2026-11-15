"""Administração de usuários, perfis e trilha de auditoria."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Page
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.models import AuditLog
from app.core.registry import registry
from app.core.security import hash_password, validate_password_strength

from . import service
from .models import Perfil, PerfilPermissao, Usuario, UsuarioPermissao
from .schemas import (
    PerfilIn,
    PerfilOut,
    RedefinirSenhaIn,
    UsuarioAtualizarIn,
    UsuarioCriarIn,
    UsuarioDetalhe,
    UsuarioOut,
)

router = APIRouter(tags=["administração"])


def _guard_grant(cu: CurrentUser, codes: set[str]) -> None:
    """Impede escalonamento de privilégio: só concede o que o próprio usuário possui."""
    unknown = codes - set(registry.permissions)
    if unknown:
        raise HTTPException(422, f"Permissões desconhecidas: {', '.join(sorted(unknown))}")
    if not cu.user.superusuario and not codes <= cu.perms:
        raise HTTPException(403, "Você não pode conceder permissões que não possui")


def _detalhe(db: Session, u: Usuario) -> dict:
    from app.modules.obras.models import usuario_obras

    data = UsuarioOut.model_validate(u).model_dump()
    data["permissoes_diretas"] = [{"codigo": p.codigo, "negar": p.negar} for p in u.permissoes_diretas]
    data["obras_ids"] = list(db.scalars(select(usuario_obras.c.obra_id).where(usuario_obras.c.usuario_id == u.id)))
    return data


def _apply(db: Session, cu: CurrentUser, u: Usuario, data: dict) -> None:
    from app.modules.obras.models import usuario_obras

    if "superusuario" in data and data["superusuario"] != u.superusuario and not cu.user.superusuario:
        raise HTTPException(403, "Apenas administradores podem conceder acesso total")
    if u.superusuario and not cu.user.superusuario:
        raise HTTPException(403, "Apenas administradores podem alterar outro administrador")
    perfis_ids = data.pop("perfis_ids", None)
    obras_ids = data.pop("obras_ids", None)
    diretas = data.pop("permissoes_diretas", None)
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
    for k, v in data.items():
        setattr(u, k, v)
    if perfis_ids is not None:
        perfis = db.scalars(select(Perfil).where(Perfil.id.in_(perfis_ids))).all()
        _guard_grant(cu, {c for p in perfis for c in p.permissoes})
        u.perfis = list(perfis)
    if diretas is not None:
        codes = {d["codigo"] for d in diretas if not d.get("negar")}
        _guard_grant(cu, codes)
        u.permissoes_diretas = [
            UsuarioPermissao(codigo=str(d["codigo"]), negar=bool(d.get("negar"))) for d in diretas
        ]
    db.flush()
    if obras_ids is not None:
        db.execute(delete(usuario_obras).where(usuario_obras.c.usuario_id == u.id))
        if obras_ids:
            db.execute(insert(usuario_obras), [{"usuario_id": u.id, "obra_id": o} for o in set(obras_ids)])


@router.get("/usuarios", response_model=Page[UsuarioOut])
def listar_usuarios(q: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, le=500),
                    ativo: bool | None = None,
                    db: Session = Depends(get_db), cu: CurrentUser = Depends(require("usuarios.ver"))):
    stmt = select(Usuario)
    if q:
        stmt = stmt.where(Usuario.nome.ilike(f"%{q}%") | Usuario.email.ilike(f"%{q}%"))
    if ativo is not None:
        stmt = stmt.where(Usuario.ativo == ativo)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(Usuario.nome).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/usuarios/{uid}", response_model=UsuarioDetalhe)
def obter_usuario(uid: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("usuarios.ver"))):
    u = db.get(Usuario, uid) or _404()
    return _detalhe(db, u)


@router.post("/usuarios", response_model=UsuarioDetalhe, status_code=201)
def criar_usuario(body: UsuarioCriarIn, request: Request, db: Session = Depends(get_db),
                  cu: CurrentUser = Depends(require("usuarios.criar"))):
    if err := validate_password_strength(body.senha):
        raise HTTPException(422, err)
    if db.scalar(select(Usuario).where(Usuario.email == body.email.lower())):
        raise HTTPException(409, "E-mail já cadastrado")
    data = body.model_dump()
    senha = data.pop("senha")
    u = Usuario(nome=data["nome"], email=data["email"].lower(), password_hash=hash_password(senha),
                trocar_senha=True)
    db.add(u)
    db.flush()
    _apply(db, cu, u, data)
    audit.log(db, user_id=cu.id, action="criar", entity="usuario", entity_id=u.id, data={"email": u.email},
              request=request)
    db.commit()
    return _detalhe(db, u)


@router.patch("/usuarios/{uid}", response_model=UsuarioDetalhe)
def atualizar_usuario(uid: int, body: UsuarioAtualizarIn, request: Request, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("usuarios.editar"))):
    u = db.get(Usuario, uid) or _404()
    data = body.model_dump(exclude_unset=True)
    if uid == cu.id and (data.get("ativo") is False or data.get("superusuario") is False):
        raise HTTPException(400, "Você não pode desativar ou rebaixar a si mesmo")
    if data.get("email") and db.scalar(select(Usuario).where(Usuario.email == data["email"].lower(), Usuario.id != uid)):
        raise HTTPException(409, "E-mail já cadastrado")
    _apply(db, cu, u, data)
    if data.get("ativo") is False:
        u.token_version += 1
        service.revoke_all(db, u.id)
    audit.log(db, user_id=cu.id, action="editar", entity="usuario", entity_id=u.id,
              data={k: v for k, v in body.model_dump(exclude_unset=True).items()}, request=request)
    db.commit()
    return _detalhe(db, u)


@router.post("/usuarios/{uid}/senha", status_code=204)
def redefinir_senha(uid: int, body: RedefinirSenhaIn, request: Request, db: Session = Depends(get_db),
                    cu: CurrentUser = Depends(require("usuarios.editar"))):
    u = db.get(Usuario, uid) or _404()
    if u.superusuario and not cu.user.superusuario:
        raise HTTPException(403, "Apenas administradores podem alterar outro administrador")
    if err := validate_password_strength(body.nova_senha):
        raise HTTPException(422, err)
    u.password_hash = hash_password(body.nova_senha)
    u.trocar_senha = body.exigir_troca
    u.token_version += 1
    u.bloqueado_ate = None
    u.tentativas_falhas = 0
    service.revoke_all(db, u.id)
    audit.log(db, user_id=cu.id, action="redefinir_senha", entity="usuario", entity_id=u.id, request=request)
    db.commit()


@router.post("/usuarios/{uid}/desbloquear", status_code=204)
def desbloquear(uid: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("usuarios.editar"))):
    u = db.get(Usuario, uid) or _404()
    u.bloqueado_ate = None
    u.tentativas_falhas = 0
    db.commit()


@router.post("/usuarios/{uid}/2fa/resetar", status_code=204)
def resetar_2fa(uid: int, request: Request, db: Session = Depends(get_db),
                cu: CurrentUser = Depends(require("usuarios.editar"))):
    u = db.get(Usuario, uid) or _404()
    if u.superusuario and not cu.user.superusuario:
        raise HTTPException(403, "Apenas administradores podem alterar outro administrador")
    u.totp_ativo = False
    u.totp_secret = None
    audit.log(db, user_id=cu.id, action="resetar_2fa", entity="usuario", entity_id=u.id, request=request)
    db.commit()


@router.delete("/usuarios/{uid}", status_code=204)
def excluir_usuario(uid: int, request: Request, db: Session = Depends(get_db),
                    cu: CurrentUser = Depends(require("usuarios.excluir"))):
    u = db.get(Usuario, uid) or _404()
    if uid == cu.id:
        raise HTTPException(400, "Você não pode excluir a si mesmo")
    if u.superusuario and not cu.user.superusuario:
        raise HTTPException(403, "Apenas administradores podem excluir outro administrador")
    # Preserva histórico: desativa em vez de remover
    u.ativo = False
    u.token_version += 1
    service.revoke_all(db, u.id)
    audit.log(db, user_id=cu.id, action="desativar", entity="usuario", entity_id=u.id, request=request)
    db.commit()


# ---------------- Perfis ----------------
@router.get("/perfis", response_model=list[PerfilOut])
def listar_perfis(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("perfis.ver"))):
    return db.scalars(select(Perfil).order_by(Perfil.nome)).all()


@router.post("/perfis", response_model=PerfilOut, status_code=201)
def criar_perfil(body: PerfilIn, request: Request, db: Session = Depends(get_db),
                 cu: CurrentUser = Depends(require("perfis.criar"))):
    _guard_grant(cu, set(body.permissoes))
    if db.scalar(select(Perfil).where(Perfil.nome == body.nome)):
        raise HTTPException(409, "Já existe um perfil com este nome")
    p = Perfil(nome=body.nome, descricao=body.descricao,
               permissoes_rel=[PerfilPermissao(codigo=c) for c in set(body.permissoes)])
    db.add(p)
    db.flush()
    audit.log(db, user_id=cu.id, action="criar", entity="perfil", entity_id=p.id, data=body.model_dump(),
              request=request)
    db.commit()
    return p


@router.patch("/perfis/{pid}", response_model=PerfilOut)
def atualizar_perfil(pid: int, body: PerfilIn, request: Request, db: Session = Depends(get_db),
                     cu: CurrentUser = Depends(require("perfis.editar"))):
    p = db.get(Perfil, pid) or _404()
    _guard_grant(cu, set(body.permissoes) ^ set(p.permissoes))
    p.nome, p.descricao = body.nome, body.descricao
    p.permissoes_rel = [PerfilPermissao(codigo=c) for c in set(body.permissoes)]
    audit.log(db, user_id=cu.id, action="editar", entity="perfil", entity_id=p.id, data=body.model_dump(),
              request=request)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/perfis/{pid}", status_code=204)
def excluir_perfil(pid: int, request: Request, db: Session = Depends(get_db),
                   cu: CurrentUser = Depends(require("perfis.excluir"))):
    p = db.get(Perfil, pid) or _404()
    if p.sistema:
        raise HTTPException(400, "Perfis do sistema não podem ser excluídos")
    db.delete(p)
    audit.log(db, user_id=cu.id, action="excluir", entity="perfil", entity_id=pid, request=request)
    db.commit()


# ---------------- Auditoria ----------------
@router.get("/auditoria")
def auditoria(page: int = Query(1, ge=1), page_size: int = Query(50, le=200), entity: str | None = None,
              user_id: int | None = None, action: str | None = None, de: datetime | None = None,
              ate: datetime | None = None,
              db: Session = Depends(get_db), cu: CurrentUser = Depends(require("auditoria.ver"))):
    stmt = select(AuditLog, Usuario.nome).outerjoin(Usuario, Usuario.id == AuditLog.user_id)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if de:
        stmt = stmt.where(AuditLog.at >= de)
    if ate:
        stmt = stmt.where(AuditLog.at <= ate)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.execute(stmt.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {"id": a.id, "at": a.at, "usuario": nome, "user_id": a.user_id, "action": a.action, "entity": a.entity,
         "entity_id": a.entity_id, "data": a.data, "ip": a.ip}
        for a, nome in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _404():
    raise HTTPException(404, "Registro não encontrado")
