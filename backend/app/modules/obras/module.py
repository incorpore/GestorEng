from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out, Pct, Qty

from .models import Medicao, MedicaoItem, Obra

STATUS = Literal["planejamento", "em_andamento", "paralisada", "concluida", "cancelada"]


class ObraIn(In):
    codigo: str | None = Field(None, max_length=30)
    nome: str = Field(min_length=2, max_length=200)
    tipo: Literal["licitacao", "particular"] = "particular"
    status: STATUS = "planejamento"
    cliente_id: int | None = None
    licitacao_id: int | None = None
    numero_contrato: str | None = Field(None, max_length=60)
    objeto: str | None = None
    endereco: str | None = Field(None, max_length=255)
    cidade: str | None = Field(None, max_length=100)
    uf: str | None = Field(None, max_length=2)
    latitude: str | None = Field(None, max_length=20)
    longitude: str | None = Field(None, max_length=20)
    valor_contrato: Money = Decimal("0")
    valor_aditivos: Money = Decimal("0")
    data_assinatura: date | None = None
    data_inicio: date | None = None
    prazo_dias: int | None = Field(None, ge=0)
    data_prevista_fim: date | None = None
    data_conclusao: date | None = None
    responsavel_tecnico: str | None = Field(None, max_length=150)
    crea_cau: str | None = Field(None, max_length=40)
    art_rrt: str | None = Field(None, max_length=60)
    fiscal_contrato: str | None = Field(None, max_length=150)
    progresso: Pct = Decimal("0")
    observacoes: str | None = None


class ObraOut(Out, ObraIn):
    cliente_nome: str | None = None
    valor_total: Money = Decimal("0")


class MedicaoItemIn(In):
    id: int | None = None
    ordem: int = 0
    codigo: str | None = Field(None, max_length=40)
    descricao: str = Field(min_length=1)
    unidade: str | None = Field(None, max_length=20)
    qtd_contratada: Qty = Decimal("0")
    qtd_anterior: Qty = Decimal("0")
    qtd_periodo: Qty = Decimal("0")
    preco_unitario: Money = Decimal("0")


class MedicaoItemOut(MedicaoItemIn):
    model_config = ConfigDict(from_attributes=True)
    qtd_acumulada: Qty
    valor_periodo: Money
    valor_acumulado: Money
    percentual: Money


class MedicaoIn(In):
    obra_id: int
    numero: int | None = None
    periodo_inicio: date | None = None
    periodo_fim: date | None = None
    data: date
    status: Literal["rascunho", "enviada", "aprovada", "faturada"] = "rascunho"
    observacoes: str | None = None
    itens: list[MedicaoItemIn] = []


class MedicaoOut(Out, MedicaoIn):
    numero: int
    obra_nome: str | None = None
    itens: list[MedicaoItemOut] = []
    valor_periodo: Money
    valor_acumulado: Money


def _obra_validate(db: Session, data: dict, obj, cu) -> None:
    if data.get("data_inicio") and data.get("prazo_dias") and not data.get("data_prevista_fim"):
        from datetime import timedelta

        data["data_prevista_fim"] = data["data_inicio"] + timedelta(days=data["prazo_dias"])


def _medicao_validate(db: Session, data: dict, obj, cu) -> None:
    if obj is None and not data.get("numero"):
        n = db.scalar(select(func.max(Medicao.numero)).where(Medicao.obra_id == data["obra_id"]))
        data["numero"] = (n or 0) + 1
    if obj is not None and obj.status == "faturada" and not cu.has("obras.aprovar_medicao"):
        raise HTTPException(403, "Medição faturada não pode ser alterada")
    if data.get("status") in ("aprovada", "faturada") and not cu.has("obras.aprovar_medicao"):
        raise HTTPException(403, "Sem permissão para aprovar medições")


obras = Crud(Obra, ObraIn, ObraOut, perm="obras", entity="obra", obra_field="id",
             search=["nome", "codigo", "numero_contrato", "cidade", "objeto"],
             filters=["status", "tipo", "cliente_id", "licitacao_id", "uf"], order="-id", validate=_obra_validate)

medicoes = Crud(Medicao, MedicaoIn, MedicaoOut, perm="obras", entity="medicao", obra_field="obra_id",
                filters=["obra_id", "status", "data"], order="-data,-numero", validate=_medicao_validate,
                children={"itens": MedicaoItem})

extra = APIRouter(prefix="/obras", tags=["obra"])


@extra.get("/{obra_id}/medicoes/proxima")
def proxima_medicao(obra_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("obras.ver"))):
    """Sugere os itens da próxima medição: parte da última medição (acumulado vira 'anterior')
    ou, se não houver, do orçamento aprovado vinculado à obra."""
    obras.get_or_404(db, cu, obra_id)
    last = db.scalar(select(Medicao).where(Medicao.obra_id == obra_id).order_by(Medicao.numero.desc()).limit(1))
    if last:
        itens = [
            {"ordem": i.ordem, "codigo": i.codigo, "descricao": i.descricao, "unidade": i.unidade,
             "qtd_contratada": float(i.qtd_contratada), "qtd_anterior": float(i.qtd_acumulada),
             "qtd_periodo": 0, "preco_unitario": float(i.preco_unitario)}
            for i in last.itens
        ]
        return {"numero": last.numero + 1, "periodo_inicio": last.periodo_fim, "itens": itens}
    from app.modules.orcamentos.models import Orcamento

    orc = db.scalar(
        select(Orcamento).where(Orcamento.obra_id == obra_id)
        .order_by((Orcamento.status == "aprovado").desc(), Orcamento.id.desc()).limit(1)
    )
    itens = []
    if orc:
        fator = 1 + (orc.bdi or 0) / 100
        itens = [
            {"ordem": i.ordem, "codigo": i.codigo, "descricao": i.descricao, "unidade": i.unidade,
             "qtd_contratada": float(i.quantidade), "qtd_anterior": 0, "qtd_periodo": 0,
             "preco_unitario": float(round((i.preco_unitario or 0) * fator, 2))}
            for i in orc.itens if not i.agrupador
        ]
    return {"numero": 1, "periodo_inicio": None, "itens": itens}


@extra.get("/{obra_id}/resumo")
def resumo_obra(obra_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("obras.ver"))):
    """Indicadores consolidados da obra vindos dos demais módulos (respeitando permissões)."""
    obra = obras.get_or_404(db, cu, obra_id)
    out: dict = {"obra_id": obra.id, "valor_total": float(obra.valor_total)}
    med = db.scalar(select(Medicao).where(Medicao.obra_id == obra_id).order_by(Medicao.numero.desc()).limit(1))
    out["medido_acumulado"] = float(med.valor_acumulado) if med else 0.0
    out["medicoes"] = db.scalar(select(func.count()).where(Medicao.obra_id == obra_id))
    if cu.has("financeiro.ver"):
        from app.modules.financeiro.models import Lancamento

        rows = db.execute(
            select(Lancamento.tipo, Lancamento.status, func.sum(Lancamento.valor))
            .where(Lancamento.obra_id == obra_id).group_by(Lancamento.tipo, Lancamento.status)
        ).all()
        fin = {f"{t}_{s}": float(v or 0) for t, s, v in rows}
        out["financeiro"] = fin
    if cu.has("diario.ver"):
        from app.modules.diario.models import DiarioObra

        out["diarios"] = db.scalar(select(func.count()).where(DiarioObra.obra_id == obra_id))
    return out


module = ModuleDef(key="obras", label="Obras", icon="building", order=10,
                   routers=[extra, obras.router("/obras"), medicoes.router("/medicoes")],
                   attachable={"obra": "obras", "medicao": "obras"},
                   template_entities={"obra": ("Obra", Obra, "obras.ver"), "medicao": ("Boletim de medição", Medicao, "obras.ver")})
module.crud_permissions(label="Obras e medições", extra={"aprovar_medicao": "Aprovar/faturar medições"})
