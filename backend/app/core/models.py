"""Modelos transversais: auditoria e arquivos."""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(60), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(60))
    data: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(64))


class Arquivo(Base):
    __tablename__ = "arquivos"
    __table_args__ = (Index("ix_arquivos_entidade", "entidade", "entidade_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True)
    nome: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(120))
    tamanho: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    entidade: Mapped[str | None] = mapped_column(String(60))
    entidade_id: Mapped[int | None] = mapped_column(Integer)
    descricao: Mapped[str | None] = mapped_column(String(255))
    enviado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # fotos: metadados de captura (marca d'água) e arquivo original preservado
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    coord_fonte: Mapped[str | None] = mapped_column(String(20))  # exif | dispositivo | obra
    capturado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    largura: Mapped[int | None] = mapped_column(Integer)
    altura: Mapped[int | None] = mapped_column(Integer)
    original_uuid: Mapped[str | None] = mapped_column(String(36))
    origem: Mapped[str | None] = mapped_column(String(20))  # sistema | link
    enviado_por_nome: Mapped[str | None] = mapped_column(String(150))
    link_id: Mapped[int | None] = mapped_column(Integer)
