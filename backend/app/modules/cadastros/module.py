from typing import Literal

from pydantic import Field

from app.core.crud import Crud
from app.core.registry import ModuleDef
from app.core.schemas import In, Out

from .models import Parceiro


class ParceiroIn(In):
    tipo: Literal["cliente", "fornecedor", "orgao", "prestador"] = "cliente"
    pessoa: Literal["PF", "PJ"] = "PJ"
    nome: str = Field(min_length=2, max_length=200)
    nome_fantasia: str | None = Field(None, max_length=200)
    documento: str | None = Field(None, max_length=20)
    inscricao_estadual: str | None = Field(None, max_length=30)
    email: str | None = Field(None, max_length=200)
    telefone: str | None = Field(None, max_length=40)
    contato: str | None = Field(None, max_length=150)
    cep: str | None = Field(None, max_length=10)
    endereco: str | None = Field(None, max_length=255)
    cidade: str | None = Field(None, max_length=100)
    uf: str | None = Field(None, max_length=2)
    pix: str | None = Field(None, max_length=150)
    banco: str | None = Field(None, max_length=150)
    observacoes: str | None = None
    ativo: bool = True


class ParceiroOut(Out, ParceiroIn):
    pass


crud = Crud(Parceiro, ParceiroIn, ParceiroOut, perm="cadastros", entity="parceiro",
            search=["nome", "nome_fantasia", "documento", "cidade"], filters=["tipo", "ativo", "uf"], order="nome")

module = ModuleDef(key="cadastros", label="Cadastros", icon="contact", order=80,
                   routers=[crud.router("/parceiros")], attachable={"parceiro": "cadastros"},
                   template_entities={"parceiro": ("Cliente / fornecedor / órgão", Parceiro, "cadastros.ver")})
module.crud_permissions(label="Clientes e fornecedores")
