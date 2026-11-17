from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LinkPublico(Base):
    """Link de acesso sem login: visualizar um diário ou enviar fotos. Cada acesso é registrado."""

    __tablename__ = "links_publicos"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    token_cifrado: Mapped[str] = mapped_column(Text)
    tipo: Mapped[str] = mapped_column(String(20))  # visualizar | fotos
    entidade: Mapped[str] = mapped_column(String(40))  # diario | obra
    entidade_id: Mapped[int] = mapped_column(Integer)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="CASCADE"), index=True)
    titulo: Mapped[str] = mapped_column(String(200))
    instrucoes: Mapped[str | None] = mapped_column(Text)
    destinatario: Mapped[str | None] = mapped_column(String(150))
    exige_localizacao: Mapped[bool] = mapped_column(Boolean, default=True)
    max_fotos: Mapped[int | None] = mapped_column(Integer)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    encerrado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    encerramento: Mapped[str | None] = mapped_column(String(20))  # finalizado | desativado | excluido
    criado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acessos: Mapped[list["AcessoLink"]] = relationship(back_populates="link", cascade="all, delete-orphan",
                                                       order_by="AcessoLink.id.desc()")


class AcessoLink(Base):
    __tablename__ = "acessos_links"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    link_id: Mapped[int] = mapped_column(ForeignKey("links_publicos.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    evento: Mapped[str] = mapped_column(String(30))  # abriu | localizacao | localizacao_negada | visualizou | enviou_foto | baixou_pdf
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    precisao: Mapped[float | None] = mapped_column(Float)
    nome: Mapped[str | None] = mapped_column(String(150))
    detalhes: Mapped[dict | None] = mapped_column(JSON)
    link: Mapped[LinkPublico] = relationship(back_populates="acessos")
