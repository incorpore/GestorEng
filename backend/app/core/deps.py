from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.modules.auth.models import Usuario

from .database import get_db
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


class CurrentUser:
    """Usuário autenticado + conjunto de permissões resolvido uma vez por requisição."""

    def __init__(self, user: Usuario):
        self.user = user
        self.id = user.id
        self.perms = user.permission_set()

    def has(self, *codes: str) -> bool:
        return self.user.superusuario or all(c in self.perms for c in codes)

    def has_any(self, *codes: str) -> bool:
        return self.user.superusuario or any(c in self.perms for c in codes)


def get_current_user(
    request: Request,
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Não autenticado", headers={"WWW-Authenticate": "Bearer"}
    )
    if cred is None:
        raise unauthorized
    data = decode_token(cred.credentials)
    if not data:
        raise unauthorized
    user = db.get(Usuario, int(data["sub"]))
    if not user or not user.ativo or user.token_version != data.get("ver"):
        raise unauthorized
    cu = CurrentUser(user)
    request.state.user = cu
    return cu


def require(*codes: str) -> Callable[..., CurrentUser]:
    def dep(cu: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not cu.has(*codes):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permissão insuficiente")
        return cu

    return dep


def require_superuser(cu: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not cu.user.superusuario:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas administradores")
    return cu
