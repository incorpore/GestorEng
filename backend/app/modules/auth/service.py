import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.audit import client_ip
from app.core.config import get_settings
from app.core.security import create_access_token, new_opaque_token, sha256

from .models import RefreshToken, Usuario

COOKIE = "struvia_refresh"


def now() -> datetime:
    return datetime.now(UTC)


def is_mobile(request: Request) -> bool:
    return request.headers.get("x-client", "").lower() == "mobile"


def issue_tokens(db: Session, user: Usuario, request: Request, response: Response, familia: str | None = None,
                 dispositivo: str | None = None) -> dict:
    s = get_settings()
    raw, hashed = new_opaque_token()
    db.add(
        RefreshToken(
            usuario_id=user.id,
            token_hash=hashed,
            familia=familia or secrets.token_hex(16),
            criado_em=now(),
            expira_em=now() + timedelta(days=s.refresh_token_days),
            ip=client_ip(request),
            dispositivo=(dispositivo or request.headers.get("user-agent", ""))[:255],
        )
    )
    access = create_access_token(user.id, user.token_version)
    out = {"access_token": access, "token_type": "bearer", "expires_in": s.access_token_minutes * 60}
    if is_mobile(request):
        out["refresh_token"] = raw
    else:
        response.set_cookie(
            COOKIE, raw, httponly=True, secure=s.cookie_secure, samesite="strict",
            max_age=s.refresh_token_days * 86400, path="/api/auth",
        )
    return out


def rotate(db: Session, raw: str, request: Request, response: Response) -> tuple[Usuario, dict] | None:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256(raw)))
    if token is None:
        return None
    if token.revogado_em or token.expira_em < now():
        return None
    if token.usado_em is not None:
        # Reuso de token já rotacionado: possível roubo -> revoga toda a família
        revoke_family(db, token.familia)
        db.commit()
        return None
    user = db.get(Usuario, token.usuario_id)
    if not user or not user.ativo:
        return None
    token.usado_em = now()
    return user, issue_tokens(db, user, request, response, familia=token.familia, dispositivo=token.dispositivo)


def revoke_family(db: Session, familia: str) -> None:
    db.execute(
        update(RefreshToken).where(RefreshToken.familia == familia, RefreshToken.revogado_em.is_(None))
        .values(revogado_em=now())
    )


def revoke_all(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken).where(RefreshToken.usuario_id == user_id, RefreshToken.revogado_em.is_(None))
        .values(revogado_em=now())
    )
