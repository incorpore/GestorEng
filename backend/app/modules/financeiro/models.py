from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money


class ContaFinanceira(TimestampMixin, Base):
    __tablename__ = "contas_financeiras"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(20), default="banco")  # banco|caixa|cartao|investimento
    banco: Mapped[str | None] = mapped_column(String(80))
    agencia: Mapped[str | None] = mapped_column(String(20))
    numero: Mapped[str | None] = mapped_column(String(30))
    saldo_inicial: Mapped[Decimal] = money()
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)


class CategoriaFinanceira(TimestampMixin, Base):
    __tablename__ = "categorias_financeiras"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(10), default="despesa")  # receita|despesa
    grupo: Mapped[str | None] = mapped_column(String(80))
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)


class Lancamento(TimestampMixin, Base):
    __tablename__ = "lancamentos"
    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(10), index=True)  # receita|despesa
    descricao: Mapped[str] = mapped_column(String(255))
    valor: Mapped[Decimal] = money()
    valor_pago: Mapped[Decimal] = money()
    vencimento: Mapped[date] = mapped_column(Date, index=True)
    competencia: Mapped[date | None] = mapped_column(Date)
    data_pagamento: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(12), default="aberto", index=True)  # aberto|parcial|pago|cancelado
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    parceiro_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"), index=True)
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias_financeiras.id", ondelete="SET NULL"))
    categoria_nome: Mapped[str | None] = mapped_column(String(120))
    conta_id: Mapped[int | None] = mapped_column(ForeignKey("contas_financeiras.id", ondelete="SET NULL"), index=True)
    medicao_id: Mapped[int | None] = mapped_column(ForeignKey("medicoes.id", ondelete="SET NULL"))
    forma_pagamento: Mapped[str | None] = mapped_column(String(30))
    numero_documento: Mapped[str | None] = mapped_column(String(60))
    parcela: Mapped[int | None] = mapped_column(Integer)
    total_parcelas: Mapped[int | None] = mapped_column(Integer)
    grupo_parcelas: Mapped[str | None] = mapped_column(String(36), index=True)
    observacoes: Mapped[str | None] = mapped_column(Text)

    obra = relationship("Obra", lazy="selectin")
    parceiro = relationship("Parceiro", lazy="selectin")
    categoria = relationship(CategoriaFinanceira, lazy="selectin")
    conta = relationship(ContaFinanceira, lazy="selectin")

    @property
    def obra_nome(self):
        return self.obra.nome if self.obra else None

    @property
    def parceiro_nome(self):
        return self.parceiro.nome if self.parceiro else None

    @property
    def categoria_label(self):
        return self.categoria.nome if self.categoria else self.categoria_nome

    @property
    def conta_nome(self):
        return self.conta.nome if self.conta else None

    @property
    def atrasado(self) -> bool:
        return self.status in ("aberto", "parcial") and self.vencimento < date.today()
