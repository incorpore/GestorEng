"""Escopo de dados por obra: usuários podem ser restritos a obras específicas."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .deps import CurrentUser


def allowed_obra_ids(db: Session, cu: CurrentUser) -> set[int] | None:
    """Retorna None quando o usuário enxerga todas as obras."""
    if cu.user.superusuario or not cu.user.obras_restritas:
        return None
    from app.modules.obras.models import usuario_obras

    rows = db.execute(select(usuario_obras.c.obra_id).where(usuario_obras.c.usuario_id == cu.id))
    return {r[0] for r in rows}
