from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money


class Licitacao(TimestampMixin, Base):
    __tablename__ = "licitacoes"
    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str | None] = mapped_column(String(60))
    orgao_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"))
    orgao_nome: Mapped[str | None] = mapped_column(String(255))
    orgao_cnpj: Mapped[str | None] = mapped_column(String(20))
    modalidade: Mapped[str | None] = mapped_column(String(80))
    criterio_julgamento: Mapped[str | None] = mapped_column(String(80))
    objeto: Mapped[str] = mapped_column(Text)
    uf: Mapped[str | None] = mapped_column(String(2))
    municipio: Mapped[str | None] = mapped_column(String(120))
    data_publicacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    data_abertura: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    data_encerramento_proposta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valor_estimado: Mapped[Decimal] = money()
    valor_proposta: Mapped[Decimal] = money()
    status: Mapped[str] = mapped_column(String(30), default="prospeccao", index=True)
    responsavel: Mapped[str | None] = mapped_column(String(150))
    link_edital: Mapped[str | None] = mapped_column(String(500))
    link_sistema: Mapped[str | None] = mapped_column(String(500))
    pncp_controle: Mapped[str | None] = mapped_column(String(80), unique=True)
    pncp_dados: Mapped[dict | None] = mapped_column(JSON)
    favorito: Mapped[bool] = mapped_column(Boolean, default=False)
    observacoes: Mapped[str | None] = mapped_column(Text)

    orgao = relationship("Parceiro", lazy="selectin")


class MonitorPncp(TimestampMixin, Base):
    """Filtros salvos para busca recorrente no PNCP."""

    __tablename__ = "pncp_monitores"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    palavras_chave: Mapped[str | None] = mapped_column(String(500))
    uf: Mapped[str | None] = mapped_column(String(2))
    codigo_municipio_ibge: Mapped[str | None] = mapped_column(String(10))
    modalidades: Mapped[str | None] = mapped_column(String(100))  # códigos separados por vírgula
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
