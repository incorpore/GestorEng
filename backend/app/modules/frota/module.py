from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out, Qty

from .models import Abastecimento, Manutencao, Veiculo


class VeiculoIn(In):
    tipo: Literal["veiculo", "maquina", "equipamento"] = "veiculo"
    identificacao: str = Field(min_length=1, max_length=60)
    descricao: str = Field(min_length=2, max_length=200)
    marca: str | None = Field(None, max_length=80)
    modelo: str | None = Field(None, max_length=80)
    ano: int | None = Field(None, ge=1900, le=2100)
    renavam: str | None = Field(None, max_length=20)
    chassi: str | None = Field(None, max_length=40)
    combustivel: str | None = Field(None, max_length=20)
    medidor: Literal["km", "horas"] = "km"
    leitura_atual: Qty = Decimal("0")
    status: Literal["disponivel", "em_uso", "manutencao", "inativo"] = "disponivel"
    obra_id: int | None = None
    responsavel_id: int | None = None
    proprio: bool = True
    valor_locacao: Money = Decimal("0")
    vencimento_licenciamento: date | None = None
    vencimento_seguro: date | None = None
    proxima_revisao_leitura: Qty | None = None
    observacoes: str | None = None


class VeiculoOut(Out, VeiculoIn):
    obra_nome: str | None = None


class ManutencaoIn(In):
    veiculo_id: int
    tipo: Literal["preventiva", "corretiva", "revisao"] = "preventiva"
    data: date
    leitura: Qty | None = None
    descricao: str = Field(min_length=2)
    fornecedor_id: int | None = None
    custo: Money = Decimal("0")
    status: Literal["agendada", "em_execucao", "concluida"] = "concluida"


class ManutencaoOut(Out, ManutencaoIn):
    veiculo_nome: str | None = None


class AbastecimentoIn(In):
    veiculo_id: int
    obra_id: int | None = None
    data: date
    leitura: Qty | None = None
    litros: Qty = Field(gt=0)
    valor_total: Money = Field(ge=0)
    combustivel: str | None = Field(None, max_length=20)
    posto: str | None = Field(None, max_length=150)
    motorista: str | None = Field(None, max_length=150)


class AbastecimentoOut(Out, AbastecimentoIn):
    veiculo_nome: str | None = None
    preco_litro: Qty = Decimal("0")


def _atualiza_leitura(db: Session, obj, cu) -> None:
    if obj.leitura and obj.veiculo_id:
        v = db.get(Veiculo, obj.veiculo_id)
        if v and (v.leitura_atual or 0) < obj.leitura:
            v.leitura_atual = obj.leitura


veiculos = Crud(Veiculo, VeiculoIn, VeiculoOut, perm="frota", entity="veiculo",
                search=["identificacao", "descricao", "marca", "modelo"], filters=["tipo", "status", "obra_id"],
                order="identificacao")
manut = Crud(Manutencao, ManutencaoIn, ManutencaoOut, perm="frota", entity="manutencao",
             filters=["veiculo_id", "tipo", "status", "data"], order="-data", after_save=_atualiza_leitura)
abast = Crud(Abastecimento, AbastecimentoIn, AbastecimentoOut, perm="frota", entity="abastecimento",
             filters=["veiculo_id", "obra_id", "data"], order="-data", after_save=_atualiza_leitura)

alertas = APIRouter(prefix="/frota", tags=["frota"])


@alertas.get("/alertas")
def alertas_frota(dias: int = 30, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("frota.ver"))):
    limite = date.today() + timedelta(days=dias)
    out = []
    rows = db.scalars(select(Veiculo).where(Veiculo.status != "inativo", or_(
        Veiculo.vencimento_licenciamento <= limite, Veiculo.vencimento_seguro <= limite,
        Veiculo.proxima_revisao_leitura <= Veiculo.leitura_atual))).all()
    for v in rows:
        if v.vencimento_licenciamento and v.vencimento_licenciamento <= limite:
            out.append({"veiculo_id": v.id, "veiculo": v.identificacao, "tipo": "licenciamento",
                        "data": v.vencimento_licenciamento})
        if v.vencimento_seguro and v.vencimento_seguro <= limite:
            out.append({"veiculo_id": v.id, "veiculo": v.identificacao, "tipo": "seguro", "data": v.vencimento_seguro})
        if v.proxima_revisao_leitura is not None and v.proxima_revisao_leitura <= v.leitura_atual:
            out.append({"veiculo_id": v.id, "veiculo": v.identificacao, "tipo": "revisao",
                        "leitura": float(v.leitura_atual)})
    return out


module = ModuleDef(key="frota", label="Frota e equipamentos", icon="truck", order=40,
                   routers=[alertas, veiculos.router("/veiculos"), manut.router("/manutencoes"),
                            abast.router("/abastecimentos")],
                   attachable={"veiculo": "frota", "manutencao": "frota"}, template_entities={"veiculo": ("Veículo / equipamento", Veiculo, "frota.ver")})
module.crud_permissions(label="Frota")
