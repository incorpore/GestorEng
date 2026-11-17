import ipaddress
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


def _confiavel(ip: str, redes) -> bool:
    try:
        end = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(end in r for r in redes)


def client_ip(request: Request | None) -> str | None:
    """IP real do visitante.

    A API só é acessível pelo nginx do Struvia, que acrescenta ao X-Forwarded-For o endereço que se conectou a ele.
    Por isso lemos a lista da direita para a esquerda (o visitante não consegue falsificar a última entrada), pulando
    apenas proxies declarados em TRUSTED_PROXIES (ex.: o IP do Nginx Proxy Manager / Cloudflare Tunnel).
    """
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        from .config import get_settings

        redes = []
        for cidr in get_settings().trusted_proxies:
            try:
                redes.append(ipaddress.ip_network(cidr, strict=False))
            except ValueError:
                continue
        cadeia = [x.strip() for x in fwd.split(",") if x.strip()]
        for ip in reversed(cadeia):
            if not _confiavel(ip, redes):
                return ip[:64]
        return cadeia[0][:64]
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
