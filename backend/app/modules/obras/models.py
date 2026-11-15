from datetime import date
from decimal import Decimal

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money, qty

usuario_obras = Table(
    "usuario_obras",
    Base.metadata,
    Column("usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("obra_id", ForeignKey("obras.id", ondelete="CASCADE"), primary_key=True),
)


class Obra(TimestampMixin, Base):
    __tablename__ = "obras"
    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str | None] = mapped_column(String(30), unique=True)
    nome: Mapped[str] = mapped_column(String(200), index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="particular", index=True)  # licitacao|particular
    status: Mapped[str] = mapped_column(String(20), default="planejamento", index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"), index=True)
    licitacao_id: Mapped[int | None] = mapped_column(ForeignKey("licitacoes.id", ondelete="SET NULL"), index=True)
    numero_contrato: Mapped[str | None] = mapped_column(String(60))
    objeto: Mapped[str | None] = mapped_column(Text)
    endereco: Mapped[str | None] = mapped_column(String(255))
    cidade: Mapped[str | None] = mapped_column(String(100))
    uf: Mapped[str | None] = mapped_column(String(2))
    latitude: Mapped[str | None] = mapped_column(String(20))
    longitude: Mapped[str | None] = mapped_column(String(20))
    valor_contrato: Mapped[Decimal] = money()
    valor_aditivos: Mapped[Decimal] = money()
    data_assinatura: Mapped[date | None] = mapped_column(Date)
    data_inicio: Mapped[date | None] = mapped_column(Date)
    prazo_dias: Mapped[int | None] = mapped_column(Integer)
    data_prevista_fim: Mapped[date | None] = mapped_column(Date)
    data_conclusao: Mapped[date | None] = mapped_column(Date)
    responsavel_tecnico: Mapped[str | None] = mapped_column(String(150))
    crea_cau: Mapped[str | None] = mapped_column(String(40))
    art_rrt: Mapped[str | None] = mapped_column(String(60))
    fiscal_contrato: Mapped[str | None] = mapped_column(String(150))
    progresso: Mapped[Decimal] = qty()
    observacoes: Mapped[str | None] = mapped_column(Text)

    cliente = relationship("Parceiro", lazy="selectin")

    @property
    def cliente_nome(self) -> str | None:
        return self.cliente.nome if self.cliente else None

    @property
    def valor_total(self) -> Decimal:
        return (self.valor_contrato or Decimal(0)) + (self.valor_aditivos or Decimal(0))


class Medicao(TimestampMixin, Base):
    """Boletim de medição."""

    __tablename__ = "medicoes"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_medicao_obra_numero"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obras.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    periodo_inicio: Mapped[date | None] = mapped_column(Date)
    periodo_fim: Mapped[date | None] = mapped_column(Date)
    data: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="rascunho")  # rascunho|enviada|aprovada|faturada
    observacoes: Mapped[str | None] = mapped_column(Text)
    itens: Mapped[list["MedicaoItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="MedicaoItem.ordem"
    )
    obra = relationship(Obra, lazy="selectin")

    @property
    def obra_nome(self) -> str | None:
        return self.obra.nome if self.obra else None

    @property
    def valor_periodo(self) -> Decimal:
        return sum((i.valor_periodo for i in self.itens), Decimal("0"))

    @property
    def valor_acumulado(self) -> Decimal:
        return sum((i.valor_acumulado for i in self.itens), Decimal("0"))


class MedicaoItem(Base):
    __tablename__ = "medicao_itens"
    id: Mapped[int] = mapped_column(primary_key=True)
    medicao_id: Mapped[int] = mapped_column(ForeignKey("medicoes.id", ondelete="CASCADE"), index=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    codigo: Mapped[str | None] = mapped_column(String(40))
    descricao: Mapped[str] = mapped_column(Text)
    unidade: Mapped[str | None] = mapped_column(String(20))
    qtd_contratada: Mapped[Decimal] = qty()
    qtd_anterior: Mapped[Decimal] = qty()
    qtd_periodo: Mapped[Decimal] = qty()
    preco_unitario: Mapped[Decimal] = money()

    @property
    def qtd_acumulada(self) -> Decimal:
        return (self.qtd_anterior or Decimal(0)) + (self.qtd_periodo or Decimal(0))

    @property
    def valor_periodo(self) -> Decimal:
        return ((self.qtd_periodo or Decimal(0)) * (self.preco_unitario or Decimal(0))).quantize(Decimal("0.01"))

    @property
    def valor_acumulado(self) -> Decimal:
        return (self.qtd_acumulada * (self.preco_unitario or Decimal(0))).quantize(Decimal("0.01"))

    @property
    def percentual(self) -> Decimal:
        if not self.qtd_contratada:
            return Decimal("0")
        return (self.qtd_acumulada / self.qtd_contratada * 100).quantize(Decimal("0.01"))
