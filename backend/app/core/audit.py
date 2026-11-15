from datetime import date, datetime
from decimal import Decimal

from fastapi import Request
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from .models import AuditLog

SENSITIVE = {"password_hash", "totp_secret", "senha", "token", "api_key", "valor_cifrado"}


def _jsonable(v):
    if isinstance(v, datetime | date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, str | int | float | bool) or v is None:
        return v
    return str(v)


def snapshot(obj) -> dict:
    return {
        c.key: _jsonable(getattr(obj, c.key))
        for c in inspect(obj).mapper.column_attrs
        if c.key not in SENSITIVE
    }


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def log(db: Session, *, user_id: int | None, action: str, entity: str, entity_id=None, data=None, request=None):
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            data=data,
            ip=client_ip(request),
        )
    )
