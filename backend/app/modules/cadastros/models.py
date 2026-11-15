from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class Parceiro(TimestampMixin, Base):
    """Clientes, fornecedores, órgãos públicos e prestadores."""

    __tablename__ = "parceiros"
    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(20), default="cliente", index=True)  # cliente|fornecedor|orgao|prestador
    pessoa: Mapped[str] = mapped_column(String(2), default="PJ")  # PF|PJ
    nome: Mapped[str] = mapped_column(String(200), index=True)
    nome_fantasia: Mapped[str | None] = mapped_column(String(200))
    documento: Mapped[str | None] = mapped_column(String(20), index=True)  # CPF/CNPJ
    inscricao_estadual: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    telefone: Mapped[str | None] = mapped_column(String(40))
    contato: Mapped[str | None] = mapped_column(String(150))
    cep: Mapped[str | None] = mapped_column(String(10))
    endereco: Mapped[str | None] = mapped_column(String(255))
    cidade: Mapped[str | None] = mapped_column(String(100))
    uf: Mapped[str | None] = mapped_column(String(2))
    pix: Mapped[str | None] = mapped_column(String(150))
    banco: Mapped[str | None] = mapped_column(String(150))
    observacoes: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
