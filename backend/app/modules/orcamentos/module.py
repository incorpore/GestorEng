from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out, Pct, Qty

from .models import Orcamento, OrcamentoItem


class ItemIn(In):
    id: int | None = None
    ordem: int = 0
    item: str | None = Field(None, max_length=20)
    agrupador: bool = False
    fonte: str | None = Field(None, max_length=20)
    codigo: str | None = Field(None, max_length=40)
    descricao: str = Field(min_length=1)
    unidade: str | None = Field(None, max_length=20)
    quantidade: Qty = Decimal("0")
    preco_unitario: Money = Decimal("0")


class ItemOut(ItemIn):
    model_config = ConfigDict(from_attributes=True)
    total: Money


class OrcamentoIn(In):
    numero: str | None = Field(None, max_length=30)
    titulo: str = Field(min_length=2, max_length=255)
    cliente_id: int | None = None
    obra_id: int | None = None
    licitacao_id: int | None = None
    data: date
    validade: date | None = None
    referencia: str | None = Field(None, max_length=120)
    bdi: Pct = Decimal("0")
    desconto: Pct = Decimal("0")
    status: Literal["rascunho", "enviado", "aprovado", "recusado", "cancelado"] = "rascunho"
    condicoes: str | None = None
    observacoes: str | None = None
    itens: list[ItemIn] = []


class OrcamentoOut(Out, OrcamentoIn):
    cliente_nome: str | None = None
    itens: list[ItemOut] = []
    custo_direto: Money
    valor_bdi: Money
    valor_desconto: Money
    total: Money


class OrcamentoResumo(Out):
    numero: str | None
    titulo: str
    cliente_nome: str | None = None
    obra_id: int | None = None
    data: date
    status: str
    total: Money


def _validate(db: Session, data: dict, obj, cu) -> None:
    if obj is None and not data.get("numero"):
        ano = (data.get("data") or date.today()).year
        n = db.scalar(select(func.count()).where(Orcamento.numero.like(f"%/{ano}"))) or 0
        data["numero"] = f"{n + 1:04d}/{ano}"


orcamentos = Crud(Orcamento, OrcamentoIn, OrcamentoOut, perm="orcamentos", entity="orcamento",
                  search=["titulo", "numero"], filters=["status", "cliente_id", "obra_id", "licitacao_id"],
                  order="-data,-id", validate=_validate, children={"itens": OrcamentoItem})

r = APIRouter(prefix="/orcamentos-acoes", tags=["orcamento"])


@r.post("/{oid}/duplicar", response_model=OrcamentoOut, status_code=201)
def duplicar(oid: int, request: Request, db: Session = Depends(get_db),
             cu: CurrentUser = Depends(require("orcamentos.criar"))):
    o = db.get(Orcamento, oid)
    if not o:
        raise HTTPException(404, "Orçamento não encontrado")
    src = OrcamentoOut.model_validate(o).model_dump()
    data = {k: src[k] for k in OrcamentoIn.model_fields}
    data["itens"] = [{k: i[k] for k in ItemIn.model_fields} for i in src["itens"]]
    data.update(numero=None, status="rascunho", data=date.today(), titulo=f"{o.titulo} (cópia)")
    _validate(db, data, None, cu)
    itens = data.pop("itens")
    novo = Orcamento(**data, itens=[OrcamentoItem(**{k: v for k, v in i.items() if k != "id"}) for i in itens])
    db.add(novo)
    db.flush()
    audit.log(db, user_id=cu.id, action="duplicar", entity="orcamento", entity_id=novo.id, data={"origem": oid},
              request=request)
    db.commit()
    db.refresh(novo)
    return novo


module = ModuleDef(key="orcamentos", label="Orçamentos", icon="calculator", order=25,
                   routers=[r, orcamentos.router("/orcamentos")], attachable={"orcamento": "orcamentos"},
                   template_entities={"orcamento": ("Orçamento", Orcamento, "orcamentos.ver")})
module.crud_permissions(label="Orçamentos")
