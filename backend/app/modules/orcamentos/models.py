from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money, qty


class Orcamento(TimestampMixin, Base):
    __tablename__ = "orcamentos"
    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str | None] = mapped_column(String(30), unique=True)
    titulo: Mapped[str] = mapped_column(String(255))
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"), index=True)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    licitacao_id: Mapped[int | None] = mapped_column(ForeignKey("licitacoes.id", ondelete="SET NULL"), index=True)
    data: Mapped[date] = mapped_column(Date)
    validade: Mapped[date | None] = mapped_column(Date)
    referencia: Mapped[str | None] = mapped_column(String(120))  # ex.: SINAPI 10/2026 - SP - não desonerado
    bdi: Mapped[Decimal] = qty()
    desconto: Mapped[Decimal] = qty()
    status: Mapped[str] = mapped_column(String(20), default="rascunho", index=True)
    condicoes: Mapped[str | None] = mapped_column(Text)
    observacoes: Mapped[str | None] = mapped_column(Text)
    itens: Mapped[list["OrcamentoItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="OrcamentoItem.ordem"
    )
    cliente = relationship("Parceiro", lazy="selectin")

    @property
    def cliente_nome(self):
        return self.cliente.nome if self.cliente else None

    @property
    def custo_direto(self) -> Decimal:
        return sum((i.total for i in self.itens if not i.agrupador), Decimal("0"))

    @property
    def valor_bdi(self) -> Decimal:
        return (self.custo_direto * (self.bdi or Decimal(0)) / 100).quantize(Decimal("0.01"))

    @property
    def valor_desconto(self) -> Decimal:
        return ((self.custo_direto + self.valor_bdi) * (self.desconto or Decimal(0)) / 100).quantize(Decimal("0.01"))

    @property
    def total(self) -> Decimal:
        return self.custo_direto + self.valor_bdi - self.valor_desconto


class OrcamentoItem(Base):
    __tablename__ = "orcamento_itens"
    id: Mapped[int] = mapped_column(primary_key=True)
    orcamento_id: Mapped[int] = mapped_column(ForeignKey("orcamentos.id", ondelete="CASCADE"), index=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    item: Mapped[str | None] = mapped_column(String(20))  # numeração: 1, 1.1, 1.1.1
    agrupador: Mapped[bool] = mapped_column(Boolean, default=False)  # etapa/título
    fonte: Mapped[str | None] = mapped_column(String(20))  # SINAPI, SICRO, Próprio...
    codigo: Mapped[str | None] = mapped_column(String(40))
    descricao: Mapped[str] = mapped_column(Text)
    unidade: Mapped[str | None] = mapped_column(String(20))
    quantidade: Mapped[Decimal] = qty()
    preco_unitario: Mapped[Decimal] = money()

    @property
    def total(self) -> Decimal:
        return ((self.quantidade or Decimal(0)) * (self.preco_unitario or Decimal(0))).quantize(Decimal("0.01"))
