from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import money, qty


class Funcionario(TimestampMixin, Base):
    __tablename__ = "funcionarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150), index=True)
    cpf: Mapped[str | None] = mapped_column(String(14), unique=True)
    rg: Mapped[str | None] = mapped_column(String(20))
    data_nascimento: Mapped[date | None] = mapped_column(Date)
    vinculo: Mapped[str] = mapped_column(String(20), default="contratado", index=True)  # contratado|diaria|horista|empreita
    funcao: Mapped[str | None] = mapped_column(String(100))
    salario: Mapped[Decimal] = money()
    valor_diaria: Mapped[Decimal] = money()
    valor_hora: Mapped[Decimal] = money()
    valor_empreita: Mapped[Decimal] = money()
    unidade_empreita: Mapped[str | None] = mapped_column(String(20))
    data_admissao: Mapped[date | None] = mapped_column(Date)
    data_demissao: Mapped[date | None] = mapped_column(Date)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    endereco: Mapped[str | None] = mapped_column(String(255))
    pix: Mapped[str | None] = mapped_column(String(150))
    banco: Mapped[str | None] = mapped_column(String(150))
    ctps: Mapped[str | None] = mapped_column(String(30))
    pis: Mapped[str | None] = mapped_column(String(20))
    tamanho_uniforme: Mapped[str | None] = mapped_column(String(10))
    tamanho_calcado: Mapped[str | None] = mapped_column(String(10))
    vencimento_aso: Mapped[date | None] = mapped_column(Date)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    observacoes: Mapped[str | None] = mapped_column(Text)

    obra = relationship("Obra", lazy="selectin")

    @property
    def obra_nome(self):
        return self.obra.nome if self.obra else None


class Apontamento(TimestampMixin, Base):
    """Registro de presença / produção: base para pagamento de diaristas, horistas e empreiteiros."""

    __tablename__ = "apontamentos"
    id: Mapped[int] = mapped_column(primary_key=True)
    funcionario_id: Mapped[int] = mapped_column(ForeignKey("funcionarios.id", ondelete="CASCADE"), index=True)
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obras.id", ondelete="SET NULL"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    horas: Mapped[Decimal] = qty()
    horas_extras: Mapped[Decimal] = qty()
    diarias: Mapped[Decimal] = qty()
    quantidade: Mapped[Decimal] = qty()  # produção (empreita)
    valor_unitario: Mapped[Decimal] = money()
    valor: Mapped[Decimal] = money()
    descricao: Mapped[str | None] = mapped_column(Text)
    pago: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    lancamento_id: Mapped[int | None] = mapped_column(ForeignKey("lancamentos.id", ondelete="SET NULL"))

    funcionario = relationship(Funcionario, lazy="selectin")
    obra = relationship("Obra", lazy="selectin")

    @property
    def funcionario_nome(self):
        return self.funcionario.nome if self.funcionario else None

    @property
    def obra_nome(self):
        return self.obra.nome if self.obra else None
