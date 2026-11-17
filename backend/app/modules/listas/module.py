"""Listas suspensas editáveis: valores padrão do sistema + valores adicionados pelos usuários."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require
from app.core.registry import ModuleDef

from .models import OpcaoLista

# lista -> (rótulo, módulo cuja permissão de criar/editar autoriza adicionar valores, valores padrão)
LISTAS: dict[str, tuple[str, str, list[str]]] = {
    "forma_pagamento": ("Formas de pagamento", "financeiro",
                        ["PIX", "Boleto", "Transferência", "Dinheiro", "Cartão", "Cheque", "Débito automático"]),
    "combustivel": ("Combustíveis", "frota", ["Diesel", "Gasolina", "Etanol", "Flex", "Elétrico", "GNV"]),
    "modalidade_licitacao": ("Modalidades de licitação", "licitacoes",
                             ["Pregão eletrônico", "Pregão presencial", "Concorrência eletrônica", "Concorrência presencial",
                              "Tomada de preços", "Convite", "Dispensa", "Inexigibilidade", "RDC", "Credenciamento",
                              "Leilão", "Diálogo competitivo", "Concurso"]),
    "criterio_julgamento": ("Critérios de julgamento", "licitacoes",
                            ["Menor preço", "Maior desconto", "Técnica e preço", "Melhor técnica", "Maior retorno econômico",
                             "Maior lance"]),
    "funcao": ("Funções", "funcionarios|diario",
               ["Servente", "Pedreiro", "Carpinteiro", "Armador", "Eletricista", "Encanador", "Pintor", "Operador de máquinas",
                "Motorista", "Mestre de obras", "Encarregado", "Engenheiro", "Técnico de segurança", "Topógrafo",
                "Apontador", "Almoxarife"]),
    "categoria_estoque": ("Categorias de estoque", "inventario",
                          ["Cimento e argamassa", "Agregados", "Aço e ferragens", "Hidráulica", "Elétrica", "Madeira",
                           "Ferramentas", "EPI", "Pintura", "Drenagem", "Pavimentação", "Combustíveis e lubrificantes"]),
    "unidade": ("Unidades de medida", "inventario|diario|orcamentos",
                ["un", "m", "m²", "m³", "kg", "t", "l", "sc", "cx", "pç", "rolo", "h", "dia", "vb"]),
    "etapa_servico": ("Etapas de serviço", "obras",
                      ["Serviços preliminares", "Terraplenagem", "Drenagem", "Pavimentação", "Estrutura", "Alvenaria",
                       "Cobertura", "Instalações", "Acabamento", "Sinalização", "Limpeza"]),
}

r = APIRouter(prefix="/listas", tags=["listas"])


def _lista(nome: str) -> tuple[str, str, list[str]]:
    if nome not in LISTAS:
        raise HTTPException(404, "Lista inexistente")
    return LISTAS[nome]


def _pode_adicionar(cu: CurrentUser, modulos: str) -> bool:
    return cu.has_any(*[f"{m}.{a}" for m in modulos.split("|") for a in ("criar", "editar")], "configuracoes.editar")


@r.get("")
def todas(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    custom: dict[str, list] = {}
    for o in db.scalars(select(OpcaoLista).order_by(OpcaoLista.lista, OpcaoLista.ordem, OpcaoLista.valor)):
        custom.setdefault(o.lista, []).append({"id": o.id, "valor": o.valor})
    return [{"lista": k, "rotulo": rot, "padrao": pad, "personalizados": custom.get(k, []),
             "pode_adicionar": _pode_adicionar(cu, mods)} for k, (rot, mods, pad) in LISTAS.items()]


@r.get("/{nome}")
def valores(nome: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    rot, mods, padrao = _lista(nome)
    extra = [o.valor for o in db.scalars(select(OpcaoLista).where(OpcaoLista.lista == nome)
                                         .order_by(OpcaoLista.ordem, OpcaoLista.valor))]
    vistos, itens = set(), []
    for v in padrao + extra:
        if v.casefold() not in vistos:
            vistos.add(v.casefold())
            itens.append(v)
    return {"lista": nome, "rotulo": rot, "valores": itens, "pode_adicionar": _pode_adicionar(cu, mods)}


class ValorIn(BaseModel):
    valor: str = Field(min_length=1, max_length=120)


@r.post("/{nome}", status_code=201)
def adicionar(nome: str, body: ValorIn, request: Request, db: Session = Depends(get_db),
              cu: CurrentUser = Depends(get_current_user)):
    _, mods, padrao = _lista(nome)
    if not _pode_adicionar(cu, mods):
        raise HTTPException(403, "Sem permissão para adicionar valores nesta lista")
    valor = " ".join(body.valor.split())
    existe = next((v for v in padrao if v.casefold() == valor.casefold()), None) or db.scalar(
        select(OpcaoLista.valor).where(OpcaoLista.lista == nome, func.lower(OpcaoLista.valor) == valor.lower()))
    if existe:
        return {"valor": existe, "novo": False}
    db.add(OpcaoLista(lista=nome, valor=valor))
    audit.log(db, user_id=cu.id, action="adicionar_opcao", entity="lista", entity_id=nome, data={"valor": valor},
              request=request)
    db.commit()
    return {"valor": valor, "novo": True}


@r.delete("/{nome}/{opcao_id}", status_code=204)
def remover(nome: str, opcao_id: int, request: Request, db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require("configuracoes.editar"))):
    o = db.get(OpcaoLista, opcao_id)
    if not o or o.lista != nome:
        raise HTTPException(404, "Valor não encontrado")
    db.delete(o)
    audit.log(db, user_id=cu.id, action="remover_opcao", entity="lista", entity_id=nome, data={"valor": o.valor},
              request=request)
    db.commit()


module = ModuleDef(key="listas", label="Listas", icon="list", order=940, core=True, routers=[r])
