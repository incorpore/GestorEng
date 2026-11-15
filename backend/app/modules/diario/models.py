from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class DiarioObra(TimestampMixin, Base):
    """Relatório Diário de Obra (RDO)."""

    __tablename__ = "diarios_obra"
    __table_args__ = (UniqueConstraint("obra_id", "data", name="uq_diario_obra_data"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obras.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    numero: Mapped[int] = mapped_column(Integer, default=1)
    clima_manha: Mapped[str | None] = mapped_column(String(20))
    clima_tarde: Mapped[str | None] = mapped_column(String(20))
    clima_noite: Mapped[str | None] = mapped_column(String(20))
    condicao: Mapped[str] = mapped_column(String(20), default="praticavel")
    temperatura: Mapped[str | None] = mapped_column(String(20))
    efetivo: Mapped[list] = mapped_column(JSON, default=list)
    equipamentos: Mapped[list] = mapped_column(JSON, default=list)
    atividades: Mapped[list] = mapped_column(JSON, default=list)
    materiais_recebidos: Mapped[str | None] = mapped_column(Text)
    ocorrencias: Mapped[str | None] = mapped_column(Text)
    visitas: Mapped[str | None] = mapped_column(Text)
    observacoes: Mapped[str | None] = mapped_column(Text)
    responsavel: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default="aberto", index=True)  # aberto|fechado
    criado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    fechado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    fechado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    obra = relationship("Obra", lazy="selectin")

    @property
    def obra_nome(self):
        return self.obra.nome if self.obra else None

    @property
    def total_efetivo(self) -> int:
        return sum(int(e.get("quantidade") or 0) for e in (self.efetivo or []))
