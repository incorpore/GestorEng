from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out, Qty

from .models import ItemEstoque, LocalEstoque, Movimentacao


class LocalIn(In):
    nome: str = Field(min_length=2, max_length=120)
    obra_id: int | None = None
    ativo: bool = True


class LocalOut(Out, LocalIn):
    pass


class ItemIn(In):
    codigo: str | None = Field(None, max_length=40)
    nome: str = Field(min_length=2, max_length=200)
    tipo: Literal["material", "ferramenta", "epi", "patrimonio"] = "material"
    categoria: str | None = Field(None, max_length=80)
    unidade: str = Field("un", max_length=10)
    estoque_minimo: Qty = Decimal("0")
    custo_medio: Money = Decimal("0")
    numero_patrimonio: str | None = Field(None, max_length=40)
    ativo: bool = True
    observacoes: str | None = None


class ItemOut(Out, ItemIn):
    pass


class MovIn(In):
    item_id: int
    tipo: Literal["entrada", "saida", "transferencia", "ajuste"]
    data: date
    quantidade: Qty
    custo_unitario: Money = Decimal("0")
    origem_id: int | None = None
    destino_id: int | None = None
    obra_id: int | None = None
    fornecedor_id: int | None = None
    funcionario_id: int | None = None
    documento: str | None = Field(None, max_length=60)
    observacoes: str | None = None


class MovOut(Out, MovIn):
    item_nome: str | None = None
    origem_nome: str | None = None
    destino_nome: str | None = None


def saldo_local(db: Session, item_id: int, local_id: int) -> Decimal:
    q = select(func.coalesce(func.sum(
        case((Movimentacao.destino_id == local_id, Movimentacao.quantidade), else_=0)
        - case((Movimentacao.origem_id == local_id, Movimentacao.quantidade), else_=0)), 0)
    ).where(Movimentacao.item_id == item_id)
    return Decimal(db.scalar(q) or 0)


def _validate(db: Session, data: dict, obj, cu) -> None:
    if obj is not None:
        raise HTTPException(409, "Movimentações não podem ser editadas; registre um ajuste ou estorno")
    t, q = data["tipo"], data["quantidade"]
    if t != "ajuste" and q <= 0:
        raise HTTPException(422, "Quantidade deve ser positiva")
    if t == "entrada":
        if not data.get("destino_id"):
            raise HTTPException(422, "Informe o local de destino")
        data["origem_id"] = None
        item = db.get(ItemEstoque, data["item_id"])
        if item and data.get("custo_unitario"):
            atual = saldo_total(db, item.id)
            total = atual + q
            if total > 0:
                item.custo_medio = ((atual * (item.custo_medio or 0) + q * data["custo_unitario"]) / total).quantize(Decimal("0.01"))
    elif t == "saida":
        if not data.get("origem_id"):
            raise HTTPException(422, "Informe o local de origem")
        data["destino_id"] = None
    elif t == "transferencia":
        if not data.get("origem_id") or not data.get("destino_id") or data["origem_id"] == data["destino_id"]:
            raise HTTPException(422, "Informe origem e destino diferentes")
    elif t == "ajuste":
        # ajuste: quantidade positiva entra no destino, negativa sai da origem
        if q >= 0:
            if not data.get("destino_id"):
                raise HTTPException(422, "Informe o local")
            data["origem_id"] = None
        else:
            loc = data.get("origem_id") or data.get("destino_id")
            if not loc:
                raise HTTPException(422, "Informe o local")
            data.update(origem_id=loc, destino_id=None, quantidade=-q)
    if data.get("origem_id"):
        disp = saldo_local(db, data["item_id"], data["origem_id"])
        if disp < data["quantidade"]:
            raise HTTPException(422, f"Saldo insuficiente no local de origem (disponível: {disp})")


def saldo_total(db: Session, item_id: int) -> Decimal:
    q = select(func.coalesce(func.sum(
        case((Movimentacao.destino_id.is_not(None), Movimentacao.quantidade), else_=0)
        - case((Movimentacao.origem_id.is_not(None), Movimentacao.quantidade), else_=0)), 0)
    ).where(Movimentacao.item_id == item_id)
    return Decimal(db.scalar(q) or 0)


locais = Crud(LocalEstoque, LocalIn, LocalOut, perm="inventario", entity="local_estoque", order="nome",
              filters=["ativo", "obra_id"])
itens = Crud(ItemEstoque, ItemIn, ItemOut, perm="inventario", entity="item_estoque", order="nome",
             search=["nome", "codigo", "categoria", "numero_patrimonio"], filters=["tipo", "ativo", "categoria"])
movs = Crud(Movimentacao, MovIn, MovOut, perm="inventario", entity="movimentacao", order="-data,-id",
            filters=["item_id", "tipo", "obra_id", "origem_id", "destino_id", "data"], validate=_validate)

r = APIRouter(prefix="/estoque", tags=["inventario"])


@r.get("/saldos")
def saldos(local_id: int | None = None, abaixo_minimo: bool = False, q: str | None = None,
           db: Session = Depends(get_db), cu: CurrentUser = Depends(require("inventario.ver"))):
    entradas = select(Movimentacao.item_id, Movimentacao.destino_id.label("local_id"),
                      Movimentacao.quantidade.label("qtd")).where(Movimentacao.destino_id.is_not(None))
    saidas = select(Movimentacao.item_id, Movimentacao.origem_id.label("local_id"),
                    (-Movimentacao.quantidade).label("qtd")).where(Movimentacao.origem_id.is_not(None))
    u = entradas.union_all(saidas).subquery()
    stmt = (select(ItemEstoque, LocalEstoque.id, LocalEstoque.nome, func.sum(u.c.qtd))
            .join(u, u.c.item_id == ItemEstoque.id).join(LocalEstoque, LocalEstoque.id == u.c.local_id)
            .group_by(ItemEstoque.id, LocalEstoque.id, LocalEstoque.nome).order_by(ItemEstoque.nome))
    if local_id:
        stmt = stmt.where(LocalEstoque.id == local_id)
    if q:
        stmt = stmt.where(ItemEstoque.nome.ilike(f"%{q}%") | ItemEstoque.codigo.ilike(f"%{q}%"))
    out = []
    for item, lid, lnome, saldo in db.execute(stmt).all():
        if abs(saldo or 0) < Decimal("0.00005"):
            continue
        out.append({"item_id": item.id, "codigo": item.codigo, "nome": item.nome, "unidade": item.unidade,
                    "local_id": lid, "local": lnome, "saldo": float(saldo), "estoque_minimo": float(item.estoque_minimo),
                    "custo_medio": float(item.custo_medio), "valor": float(saldo * (item.custo_medio or 0))})
    if abaixo_minimo:
        tot: dict[int, float] = {}
        for o in out:
            tot[o["item_id"]] = tot.get(o["item_id"], 0) + o["saldo"]
        out = [o for o in out if tot[o["item_id"]] < o["estoque_minimo"]]
    return out


module = ModuleDef(key="inventario", label="Inventário", icon="package", order=60,
                   routers=[r, itens.router("/itens-estoque"), locais.router("/locais-estoque"),
                            movs.router("/movimentacoes")],
                   attachable={"item_estoque": "inventario"})
module.crud_permissions(label="Inventário")
