from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out, Qty
from app.core.scope import allowed_obra_ids

from .models import Apontamento, Funcionario

VINCULO = Literal["contratado", "diaria", "horista", "empreita"]


class FuncionarioIn(In):
    nome: str = Field(min_length=2, max_length=150)
    cpf: str | None = Field(None, max_length=14)
    rg: str | None = Field(None, max_length=20)
    data_nascimento: date | None = None
    vinculo: VINCULO = "contratado"
    funcao: str | None = Field(None, max_length=100)
    salario: Money = Decimal("0")
    valor_diaria: Money = Decimal("0")
    valor_hora: Money = Decimal("0")
    valor_empreita: Money = Decimal("0")
    unidade_empreita: str | None = Field(None, max_length=20)
    data_admissao: date | None = None
    data_demissao: date | None = None
    ativo: bool = True
    telefone: str | None = Field(None, max_length=30)
    email: str | None = Field(None, max_length=200)
    endereco: str | None = Field(None, max_length=255)
    pix: str | None = Field(None, max_length=150)
    banco: str | None = Field(None, max_length=150)
    ctps: str | None = Field(None, max_length=30)
    pis: str | None = Field(None, max_length=20)
    tamanho_uniforme: str | None = Field(None, max_length=10)
    tamanho_calcado: str | None = Field(None, max_length=10)
    vencimento_aso: date | None = None
    obra_id: int | None = None
    observacoes: str | None = None


SENSIVEIS = {"cpf", "rg", "data_nascimento", "salario", "valor_diaria", "valor_hora", "valor_empreita", "endereco",
             "pix", "banco", "ctps", "pis"}


class FuncionarioOut(Out, FuncionarioIn):
    obra_nome: str | None = None
    salario: Money | None = None
    valor_diaria: Money | None = None
    valor_hora: Money | None = None
    valor_empreita: Money | None = None


class FuncionarioPublico(Out):
    """Visão sem dados salariais nem documentos (para quem não tem 'funcionarios.ver_salarios')."""

    nome: str
    vinculo: str
    funcao: str | None = None
    ativo: bool
    telefone: str | None = None
    obra_id: int | None = None
    obra_nome: str | None = None


class ApontamentoIn(In):
    funcionario_id: int
    obra_id: int | None = None
    data: date
    horas: Qty = Decimal("0")
    horas_extras: Qty = Decimal("0")
    diarias: Qty = Decimal("0")
    quantidade: Qty = Decimal("0")
    valor_unitario: Money = Decimal("0")
    descricao: str | None = None


class ApontamentoOut(Out, ApontamentoIn):
    valor: Money | None = None
    valor_unitario: Money | None = None
    pago: bool
    funcionario_nome: str | None = None
    obra_nome: str | None = None
    lancamento_id: int | None = None


def calcular(func: Funcionario, a: dict) -> Decimal:
    v = func.vinculo
    if v == "horista":
        vh = func.valor_hora or 0
        return (Decimal(a.get("horas") or 0) * vh + Decimal(a.get("horas_extras") or 0) * vh * Decimal("1.5")).quantize(Decimal("0.01"))
    if v == "diaria":
        return (Decimal(a.get("diarias") or 0) * (func.valor_diaria or 0)).quantize(Decimal("0.01"))
    if v == "empreita":
        vu = Decimal(a.get("valor_unitario") or 0) or (func.valor_empreita or 0)
        a["valor_unitario"] = vu
        return (Decimal(a.get("quantidade") or 0) * vu).quantize(Decimal("0.01"))
    return Decimal("0")


def _apont_validate(db: Session, data: dict, obj, cu) -> None:
    if obj is not None and obj.pago:
        raise HTTPException(409, "Apontamento já pago não pode ser alterado")
    fid = data.get("funcionario_id") or (obj.funcionario_id if obj else None)
    func = db.get(Funcionario, fid)
    if not func:
        raise HTTPException(422, "Funcionário inválido")
    merged = {**({c: getattr(obj, c) for c in ApontamentoIn.model_fields} if obj else {}), **data}
    if not merged.get("obra_id") and func.obra_id:
        data["obra_id"] = func.obra_id
    data["valor"] = calcular(func, merged)
    if "valor_unitario" in merged:
        data["valor_unitario"] = merged["valor_unitario"]


funcionarios = Crud(Funcionario, FuncionarioIn, FuncionarioOut, perm="funcionarios", entity="funcionario",
                    search=["nome", "cpf", "funcao"], filters=["vinculo", "ativo", "obra_id"], order="nome",
                    redact=("funcionarios.ver_salarios", SENSIVEIS))
apontamentos = Crud(Apontamento, ApontamentoIn, ApontamentoOut, perm="apontamentos", entity="apontamento",
                    obra_field="obra_id", filters=["funcionario_id", "obra_id", "data", "pago"], order="-data",
                    validate=_apont_validate, redact=("funcionarios.ver_salarios", {"valor", "valor_unitario"}))

extra = APIRouter(prefix="/funcionarios-relatorios", tags=["funcionario"])


class FolhaIn(BaseModel):
    inicio: date
    fim: date
    obra_id: int | None = None


@extra.post("/folha")
def folha(body: FolhaIn, db: Session = Depends(get_db),
          cu: CurrentUser = Depends(require("apontamentos.ver", "funcionarios.ver_salarios"))):
    """Resumo de pagamentos no período (diaristas, horistas e empreiteiros a partir dos apontamentos)."""
    stmt = select(Apontamento).where(Apontamento.data >= body.inicio, Apontamento.data <= body.fim)
    if body.obra_id:
        stmt = stmt.where(Apontamento.obra_id == body.obra_id)
    ids = allowed_obra_ids(db, cu)
    if ids is not None:
        stmt = stmt.where(Apontamento.obra_id.in_(ids or [-1]))
    agg: dict[int, dict] = defaultdict(lambda: {"dias": 0, "horas": Decimal(0), "horas_extras": Decimal(0),
                                                "diarias": Decimal(0), "quantidade": Decimal(0), "valor": Decimal(0),
                                                "valor_pago": Decimal(0), "apontamentos": 0})
    funcs: dict[int, Funcionario] = {}
    for a in db.scalars(stmt):
        g = agg[a.funcionario_id]
        funcs[a.funcionario_id] = a.funcionario
        g["apontamentos"] += 1
        g["horas"] += a.horas or 0
        g["horas_extras"] += a.horas_extras or 0
        g["diarias"] += a.diarias or 0
        g["quantidade"] += a.quantidade or 0
        g["valor"] += a.valor or 0
        if a.pago:
            g["valor_pago"] += a.valor or 0
    linhas = []
    for fid, g in agg.items():
        f = funcs[fid]
        linhas.append({"funcionario_id": fid, "nome": f.nome, "vinculo": f.vinculo, "funcao": f.funcao, "pix": f.pix,
                       **{k: float(v) for k, v in g.items()},
                       "a_pagar": float(g["valor"] - g["valor_pago"])})
    linhas.sort(key=lambda x: x["nome"])
    return {"linhas": linhas, "total": sum(x["valor"] for x in linhas), "a_pagar": sum(x["a_pagar"] for x in linhas)}


class PagarIn(BaseModel):
    apontamentos_ids: list[int] = Field(min_length=1)
    data_pagamento: date
    conta_id: int | None = None
    gerar_lancamento: bool = True


@extra.post("/pagar")
def pagar(body: PagarIn, request: Request, db: Session = Depends(get_db),
          cu: CurrentUser = Depends(require("apontamentos.editar", "funcionarios.ver_salarios"))):
    """Marca apontamentos como pagos e (opcionalmente) gera despesas no financeiro, uma por funcionário/obra."""
    rows = db.scalars(select(Apontamento).where(Apontamento.id.in_(body.apontamentos_ids), Apontamento.pago.is_(False))).all()
    ids = allowed_obra_ids(db, cu)
    if ids is not None and any(a.obra_id not in ids for a in rows):
        raise HTTPException(403, "Sem acesso a uma das obras")
    grupos: dict[tuple, list[Apontamento]] = defaultdict(list)
    for a in rows:
        grupos[(a.funcionario_id, a.obra_id)].append(a)
    criados = []
    if body.gerar_lancamento:
        if not cu.has("financeiro.criar"):
            raise HTTPException(403, "Sem permissão para lançar no financeiro")
        from app.modules.financeiro.models import Lancamento

        for (_fid, oid), itens in grupos.items():
            total = sum((a.valor for a in itens), Decimal(0))
            f = itens[0].funcionario
            lanc = Lancamento(tipo="despesa", descricao=f"Mão de obra - {f.nome} ({len(itens)} apont.)", valor=total,
                              vencimento=body.data_pagamento, data_pagamento=body.data_pagamento, status="pago",
                              obra_id=oid, conta_id=body.conta_id, categoria_nome="Mão de obra",
                              valor_pago=total)
            db.add(lanc)
            db.flush()
            criados.append(lanc.id)
            for a in itens:
                a.lancamento_id = lanc.id
    for a in rows:
        a.pago = True
    audit.log(db, user_id=cu.id, action="pagar_apontamentos", entity="apontamento",
              data={"ids": [a.id for a in rows], "lancamentos": criados}, request=request)
    db.commit()
    return {"pagos": len(rows), "lancamentos": criados}


# Rota de listagem "pública" (sem salários) para seleção em outros módulos
publico = APIRouter(prefix="/equipe", tags=["funcionario"])


@publico.get("", response_model=list[FuncionarioPublico])
def equipe(obra_id: int | None = None, q: str | None = None, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("funcionarios.ver"))):
    stmt = select(Funcionario).where(Funcionario.ativo.is_(True))
    if obra_id:
        stmt = stmt.where(Funcionario.obra_id == obra_id)
    if q:
        stmt = stmt.where(Funcionario.nome.ilike(f"%{q}%"))
    return db.scalars(stmt.order_by(Funcionario.nome).limit(500)).all()


module = ModuleDef(key="funcionarios", label="Funcionários", icon="users", order=50,
                   routers=[extra, publico, funcionarios.router("/funcionarios"), apontamentos.router("/apontamentos")],
                   attachable={"funcionario": "funcionarios"}, template_entities={"funcionario": ("Funcionário", Funcionario, "funcionarios.ver_salarios")})
module.crud_permissions(label="Funcionários", extra={"ver_salarios": "Ver salários e dados pessoais"})
module.crud_permissions("apontamentos", "Apontamentos (presença/produção)")
