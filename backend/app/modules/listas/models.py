from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class OpcaoLista(TimestampMixin, Base):
    """Valores adicionados pelos usuários às listas suspensas (forma de pagamento, função, unidade...)."""

    __tablename__ = "opcoes_lista"
    __table_args__ = (UniqueConstraint("lista", "valor", name="uq_opcao_lista_valor"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    lista: Mapped[str] = mapped_column(String(40), index=True)
    valor: Mapped[str] = mapped_column(String(120))
    ordem: Mapped[int] = mapped_column(Integer, default=1000)
