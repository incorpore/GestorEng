from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BackupLog(Base):
    __tablename__ = "backups"
    id: Mapped[int] = mapped_column(primary_key=True)
    iniciado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="executando")  # executando|sucesso|erro
    origem: Mapped[str] = mapped_column(String(20), default="agendado")  # agendado|manual
    chave: Mapped[str | None] = mapped_column(String(500))
    tamanho: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(String(64))
    mensagem: Mapped[str | None] = mapped_column(Text)
