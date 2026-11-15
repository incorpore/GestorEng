import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import case, extract, func, select, text
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out
from app.core.scope import allowed_obra_ids

from .models import CategoriaFinanceira, ContaFinanceira, Lancamento


class ContaIn(In):
    nome: str = Field(min_length=2, max_length=120)
    tipo: Literal["banco", "caixa", "cartao", "investimento"] = "banco"
    banco: str | None = Field(None, max_length=80)
    agencia: str | None = Field(None, max_length=20)
    numero: str | None = Field(None, max_length=30)
    saldo_inicial: Money = Decimal("0")
    ativa: bool = True


class ContaOut(Out, ContaIn):
    pass


class CategoriaIn(In):
    nome: str = Field(min_length=2, max_length=120)
    tipo: Literal["receita", "despesa"] = "despesa"
    grupo: str | None = Field(None, max_length=80)
    ativa: bool = True


class CategoriaOut(Out, CategoriaIn):
    pass


class LancamentoIn(In):
    tipo: Literal["receita", "despesa"]
    descricao: str = Field(min_length=2, max_length=255)
    valor: Money = Field(gt=0)
    vencimento: date
    competencia: date | None = None
    obra_id: int | None = None
    parceiro_id: int | None = None
    categoria_id: int | None = None
    conta_id: int | None = None
    medicao_id: int | None = None
    forma_pagamento: str | None = Field(None, max_length=30)
    numero_documento: str | None = Field(None, max_length=60)
    observacoes: str | None = None
    status: Literal["aberto", "parcial", "pago", "cancelado"] = "aberto"
    valor_pago: Money = Decimal("0")
    data_pagamento: date | None = None


class LancamentoOut(Out, LancamentoIn):
    parcela: int | None = None
    total_parcelas: int | None = None
    obra_nome: str | None = None
    parceiro_nome: str | None = None
    categoria_label: str | None = None
    conta_nome: str | None = None
    atrasado: bool = False


def _validate(db: Session, data: dict, obj, cu) -> None:
    status = data.get("status", obj.status if obj else "aberto")
    if status == "pago":
        valor = data.get("valor", obj.valor if obj else 0)
        if not data.get("valor_pago") and not (obj and obj.valor_pago):
            data["valor_pago"] = valor
        if not data.get("data_pagamento") and not (obj and obj.data_pagamento):
            data["data_pagamento"] = date.today()


contas = Crud(ContaFinanceira, ContaIn, ContaOut, perm="financeiro", entity="conta_financeira", order="nome",
              filters=["ativa", "tipo"])
categorias = Crud(CategoriaFinanceira, CategoriaIn, CategoriaOut, perm="financeiro", entity="categoria_financeira",
                  order="tipo,nome", filters=["tipo", "ativa"], search=["nome", "grupo"])
lancamentos = Crud(Lancamento, LancamentoIn, LancamentoOut, perm="financeiro", entity="lancamento",
                   obra_field="obra_id", search=["descricao", "numero_documento", "observacoes"],
                   filters=["tipo", "status", "obra_id", "parceiro_id", "categoria_id", "conta_id", "vencimento",
                            "data_pagamento", "medicao_id"],
                   order="vencimento", validate=_validate)

r = APIRouter(prefix="/financeiro", tags=["financeiro"])


def _add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, monthrange(y, m)[1]))


class ParceladoIn(LancamentoIn):
    parcelas: int = Field(2, ge=2, le=120)
    intervalo_meses: int = Field(1, ge=1, le=12)


@r.post("/parcelado", response_model=list[LancamentoOut], status_code=201)
def parcelado(body: ParceladoIn, request: Request, db: Session = Depends(get_db),
              cu: CurrentUser = Depends(require("financeiro.criar"))):
    data = body.model_dump(exclude={"parcelas", "intervalo_meses", "vencimento", "descricao", "status", "valor_pago",
                                    "data_pagamento"})
    total = Decimal(data.pop("valor"))
    base = (total / body.parcelas).quantize(Decimal("0.01"))
    grupo = str(uuid.uuid4())
    out = []
    for i in range(body.parcelas):
        valor = base if i < body.parcelas - 1 else total - base * (body.parcelas - 1)
        lanc = Lancamento(**data, status="aberto", valor_pago=0, data_pagamento=None, valor=valor, vencimento=_add_months(body.vencimento, i * body.intervalo_meses),
                          descricao=f"{body.descricao} ({i + 1}/{body.parcelas})", parcela=i + 1,
                          total_parcelas=body.parcelas, grupo_parcelas=grupo)
        db.add(lanc)
        out.append(lanc)
    db.flush()
    audit.log(db, user_id=cu.id, action="criar_parcelado", entity="lancamento", entity_id=grupo,
              data={"ids": [x.id for x in out]}, request=request)
    db.commit()
    return out


class BaixaIn(BaseModel):
    valor: Money = Field(gt=0)
    data_pagamento: date
    conta_id: int | None = None
    forma_pagamento: str | None = Field(None, max_length=30)


@r.post("/lancamentos/{lid}/baixar", response_model=LancamentoOut)
def baixar(lid: int, body: BaixaIn, request: Request, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("financeiro.baixar"))):
    lanc = db.get(Lancamento, lid)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    if lanc.status in ("pago", "cancelado"):
        raise HTTPException(409, "Lançamento já quitado ou cancelado")
    lanc.valor_pago = (lanc.valor_pago or 0) + body.valor
    lanc.data_pagamento = body.data_pagamento
    lanc.conta_id = body.conta_id or lanc.conta_id
    lanc.forma_pagamento = body.forma_pagamento or lanc.forma_pagamento
    lanc.status = "pago" if lanc.valor_pago >= lanc.valor else "parcial"
    audit.log(db, user_id=cu.id, action="baixar", entity="lancamento", entity_id=lid,
              data={"valor": str(body.valor)}, request=request)
    db.commit()
    db.refresh(lanc)
    return lanc


@r.post("/lancamentos/{lid}/estornar", response_model=LancamentoOut)
def estornar(lid: int, request: Request, db: Session = Depends(get_db),
             cu: CurrentUser = Depends(require("financeiro.baixar"))):
    lanc = db.get(Lancamento, lid)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    lanc.valor_pago, lanc.data_pagamento, lanc.status = Decimal(0), None, "aberto"
    audit.log(db, user_id=cu.id, action="estornar", entity="lancamento", entity_id=lid, request=request)
    db.commit()
    db.refresh(lanc)
    return lanc


@r.get("/saldos")
def saldos(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("financeiro.ver"))):
    mov = (
        select(
            Lancamento.conta_id,
            func.sum(case((Lancamento.tipo == "receita", Lancamento.valor_pago), else_=-Lancamento.valor_pago)),
        )
        .where(Lancamento.status.in_(["pago", "parcial"]), Lancamento.conta_id.is_not(None))
        .group_by(Lancamento.conta_id)
    )
    movs = dict(db.execute(mov).all())
    out = []
    for c in db.scalars(select(ContaFinanceira).where(ContaFinanceira.ativa.is_(True)).order_by(ContaFinanceira.nome)):
        out.append({"id": c.id, "nome": c.nome, "tipo": c.tipo,
                    "saldo": float((c.saldo_inicial or 0) + (movs.get(c.id) or 0))})
    return out


@r.get("/resumo")
def resumo(ano: int | None = None, obra_id: int | None = None, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("financeiro.ver"))):
    """Fluxo de caixa mensal (previsto x realizado) e indicadores."""
    ano = ano or date.today().year
    base = select(Lancamento).where(Lancamento.status != "cancelado")
    if obra_id:
        base = base.where(Lancamento.obra_id == obra_id)
    ids = allowed_obra_ids(db, cu)
    if ids is not None:
        base = base.where(Lancamento.obra_id.in_(ids or [-1]))
    sub = base.subquery()
    mes = extract("month", sub.c.vencimento)
    rows = db.execute(
        select(mes, sub.c.tipo, func.sum(sub.c.valor), func.sum(sub.c.valor_pago))
        .where(extract("year", sub.c.vencimento) == ano).group_by(mes, sub.c.tipo)
    ).all()
    meses = [{"mes": m, "receita_prevista": 0.0, "despesa_prevista": 0.0, "receita_realizada": 0.0,
              "despesa_realizada": 0.0} for m in range(1, 13)]
    for m, tipo, prev, real in rows:
        meses[int(m) - 1][f"{tipo}_prevista"] = float(prev or 0)
        meses[int(m) - 1][f"{tipo}_realizada"] = float(real or 0)
    hoje = date.today()
    abertos = db.execute(
        select(sub.c.tipo, func.sum(sub.c.valor - sub.c.valor_pago),
               func.sum(case((sub.c.vencimento < hoje, sub.c.valor - sub.c.valor_pago), else_=0)))
        .where(sub.c.status.in_(["aberto", "parcial"])).group_by(sub.c.tipo)
    ).all()
    ind = {"a_receber": 0.0, "a_pagar": 0.0, "receber_atrasado": 0.0, "pagar_atrasado": 0.0}
    for tipo, aberto, atrasado in abertos:
        if tipo == "receita":
            ind["a_receber"], ind["receber_atrasado"] = float(aberto or 0), float(atrasado or 0)
        else:
            ind["a_pagar"], ind["pagar_atrasado"] = float(aberto or 0), float(atrasado or 0)
    por_cat = db.execute(
        select(func.coalesce(CategoriaFinanceira.nome, sub.c.categoria_nome, "Sem categoria"), func.sum(sub.c.valor))
        .select_from(sub).outerjoin(CategoriaFinanceira, CategoriaFinanceira.id == sub.c.categoria_id)
        .where(sub.c.tipo == "despesa", extract("year", sub.c.vencimento) == ano)
        .group_by(text("1")).order_by(text("2 DESC")).limit(10)
    ).all()
    return {"ano": ano, "meses": meses, "indicadores": ind,
            "despesas_por_categoria": [{"categoria": c, "valor": float(v or 0)} for c, v in por_cat]}


module = ModuleDef(key="financeiro", label="Financeiro", icon="wallet", order=30,
                   routers=[r, lancamentos.router("/lancamentos"), contas.router("/contas-financeiras"),
                            categorias.router("/categorias-financeiras")],
                   attachable={"lancamento": "financeiro"}, template_entities={"lancamento": ("Lançamento financeiro", Lancamento, "financeiro.ver")})
module.crud_permissions(label="Financeiro", extra={"baixar": "Baixar/estornar pagamentos"})
