from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money, qty


class LocalEstoque(TimestampMixin, Base):
    __tablename__ = "locais_estoque"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class ItemEstoque(TimestampMixin, Base):
    __tablename__ = "itens_estoque"
    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str | None] = mapped_column(String(40), unique=True)
    nome: Mapped[str] = mapped_column(String(200), index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="material")  # material|ferramenta|epi|patrimonio
    categoria: Mapped[str | None] = mapped_column(String(80))
    unidade: Mapped[str] = mapped_column(String(10), default="un")
    estoque_minimo: Mapped[Decimal] = qty()
    custo_medio: Mapped[Decimal] = money()
    numero_patrimonio: Mapped[str | None] = mapped_column(String(40))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    observacoes: Mapped[str | None] = mapped_column(Text)


class Movimentacao(TimestampMixin, Base):
    __tablename__ = "movimentacoes_estoque"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("itens_estoque.id", ondelete="RESTRICT"), index=True)
    tipo: Mapped[str] = mapped_column(String(15))  # entrada|saida|transferencia|ajuste
    data: Mapped[date] = mapped_column(Date, index=True)
    quantidade: Mapped[Decimal] = qty()
    custo_unitario: Mapped[Decimal] = money()
    origem_id: Mapped[int | None] = mapped_column(ForeignKey("locais_estoque.id", ondelete="RESTRICT"))
    destino_id: Mapped[int | None] = mapped_column(ForeignKey("locais_estoque.id", ondelete="RESTRICT"))
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    fornecedor_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"))
    funcionario_id: Mapped[int | None] = mapped_column(ForeignKey("funcionarios.id", ondelete="SET NULL"))
    documento: Mapped[str | None] = mapped_column(String(60))
    observacoes: Mapped[str | None] = mapped_column(Text)

    item = relationship(ItemEstoque, lazy="selectin")
    origem = relationship(LocalEstoque, foreign_keys=[origem_id], lazy="selectin")
    destino = relationship(LocalEstoque, foreign_keys=[destino_id], lazy="selectin")

    @property
    def item_nome(self):
        return self.item.nome if self.item else None

    @property
    def origem_nome(self):
        return self.origem.nome if self.origem else None

    @property
    def destino_nome(self):
        return self.destino.nome if self.destino else None
