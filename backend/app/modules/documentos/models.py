from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class ModeloDocumento(TimestampMixin, Base):
    __tablename__ = "modelos_documento"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    tipo: Mapped[str] = mapped_column(String(30), index=True)
    entidade: Mapped[str | None] = mapped_column(String(40))  # contexto principal (obra, medicao, funcionario...)
    conteudo: Mapped[str] = mapped_column(Text, default="")
    css: Mapped[str | None] = mapped_column(Text)
    usar_timbrado: Mapped[bool] = mapped_column(Boolean, default=True)
    orientacao: Mapped[str] = mapped_column(String(10), default="retrato")
    margens: Mapped[dict | None] = mapped_column(JSON)  # sobrepõe as margens do timbrado
    prefixo_numero: Mapped[str | None] = mapped_column(String(40))  # ex.: "Ofício nº"
    numerar: Mapped[bool] = mapped_column(Boolean, default=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class Documento(TimestampMixin, Base):
    __tablename__ = "documentos"
    __table_args__ = (UniqueConstraint("tipo", "ano", "sequencial", name="uq_documento_numeracao"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    modelo_id: Mapped[int | None] = mapped_column(ForeignKey("modelos_documento.id", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(String(30), index=True)
    ano: Mapped[int] = mapped_column(Integer)
    sequencial: Mapped[int | None] = mapped_column(Integer)
    numero: Mapped[str | None] = mapped_column(String(60))
    titulo: Mapped[str] = mapped_column(String(255))
    data_emissao: Mapped[date] = mapped_column(Date)
    entidade: Mapped[str | None] = mapped_column(String(40))
    entidade_id: Mapped[int | None] = mapped_column(Integer)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    destinatario: Mapped[str | None] = mapped_column(String(255))
    conteudo: Mapped[str] = mapped_column(Text, default="")
    css: Mapped[str | None] = mapped_column(Text)
    usar_timbrado: Mapped[bool] = mapped_column(Boolean, default=True)
    orientacao: Mapped[str] = mapped_column(String(10), default="retrato")
    margens: Mapped[dict | None] = mapped_column(JSON)
    variaveis: Mapped[dict | None] = mapped_column(JSON)  # variáveis extras informadas pelo usuário
    status: Mapped[str] = mapped_column(String(25), default="rascunho", index=True)
    pdf_arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivos.id", ondelete="SET NULL"))
    pdf_assinado_id: Mapped[int | None] = mapped_column(ForeignKey("arquivos.id", ondelete="SET NULL"))
    documenso_id: Mapped[str | None] = mapped_column(String(60), index=True)
    assinantes: Mapped[list | None] = mapped_column(JSON)
    enviado_assinatura_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))

    modelo = relationship(ModeloDocumento, lazy="selectin")
