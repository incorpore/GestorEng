from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money, qty


class Veiculo(TimestampMixin, Base):
    __tablename__ = "veiculos"
    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(20), default="veiculo", index=True)  # veiculo|maquina|equipamento
    identificacao: Mapped[str] = mapped_column(String(60), unique=True)  # placa ou patrimônio
    descricao: Mapped[str] = mapped_column(String(200))
    marca: Mapped[str | None] = mapped_column(String(80))
    modelo: Mapped[str | None] = mapped_column(String(80))
    ano: Mapped[int | None] = mapped_column(Integer)
    renavam: Mapped[str | None] = mapped_column(String(20))
    chassi: Mapped[str | None] = mapped_column(String(40))
    combustivel: Mapped[str | None] = mapped_column(String(20))
    medidor: Mapped[str] = mapped_column(String(10), default="km")  # km|horas
    leitura_atual: Mapped[Decimal] = qty()
    status: Mapped[str] = mapped_column(String(20), default="disponivel", index=True)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("funcionarios.id", ondelete="SET NULL"))
    proprio: Mapped[bool] = mapped_column(default=True)
    valor_locacao: Mapped[Decimal] = money()
    vencimento_licenciamento: Mapped[date | None] = mapped_column(Date)
    vencimento_seguro: Mapped[date | None] = mapped_column(Date)
    proxima_revisao_leitura: Mapped[Decimal | None] = qty(default=None, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text)

    obra = relationship("Obra", lazy="selectin")

    @property
    def obra_nome(self):
        return self.obra.nome if self.obra else None


class Manutencao(TimestampMixin, Base):
    __tablename__ = "manutencoes"
    id: Mapped[int] = mapped_column(primary_key=True)
    veiculo_id: Mapped[int] = mapped_column(ForeignKey("veiculos.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="preventiva")  # preventiva|corretiva|revisao
    data: Mapped[date] = mapped_column(Date, index=True)
    leitura: Mapped[Decimal | None] = qty(default=None, nullable=True)
    descricao: Mapped[str] = mapped_column(Text)
    fornecedor_id: Mapped[int | None] = mapped_column(ForeignKey("parceiros.id", ondelete="SET NULL"))
    custo: Mapped[Decimal] = money()
    status: Mapped[str] = mapped_column(String(20), default="concluida")  # agendada|em_execucao|concluida
    veiculo = relationship(Veiculo, lazy="selectin")

    @property
    def veiculo_nome(self):
        return f"{self.veiculo.identificacao} - {self.veiculo.descricao}" if self.veiculo else None


class Abastecimento(TimestampMixin, Base):
    __tablename__ = "abastecimentos"
    id: Mapped[int] = mapped_column(primary_key=True)
    veiculo_id: Mapped[int] = mapped_column(ForeignKey("veiculos.id", ondelete="CASCADE"), index=True)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    leitura: Mapped[Decimal | None] = qty(default=None, nullable=True)
    litros: Mapped[Decimal] = qty()
    valor_total: Mapped[Decimal] = money()
    combustivel: Mapped[str | None] = mapped_column(String(20))
    posto: Mapped[str | None] = mapped_column(String(150))
    motorista: Mapped[str | None] = mapped_column(String(150))
    veiculo = relationship(Veiculo, lazy="selectin")

    @property
    def veiculo_nome(self):
        return f"{self.veiculo.identificacao} - {self.veiculo.descricao}" if self.veiculo else None

    @property
    def preco_litro(self) -> Decimal:
        return (self.valor_total / self.litros).quantize(Decimal("0.001")) if self.litros else Decimal("0")
