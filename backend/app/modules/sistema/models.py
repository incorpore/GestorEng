from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class Configuracao(TimestampMixin, Base):
    __tablename__ = "configuracoes"
    chave: Mapped[str] = mapped_column(String(60), primary_key=True)
    valor: Mapped[dict] = mapped_column(JSON, default=dict)


class Integracao(TimestampMixin, Base):
    __tablename__ = "integracoes"
    chave: Mapped[str] = mapped_column(String(40), primary_key=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    segredo_cifrado: Mapped[str | None] = mapped_column(Text)
