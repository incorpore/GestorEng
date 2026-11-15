import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Money, Out

from . import pncp
from .models import Licitacao, MonitorPncp

STATUS = Literal["prospeccao", "em_analise", "documentacao", "proposta_enviada", "em_disputa",
                 "ganha", "perdida", "desistencia", "cancelada", "suspensa"]


class LicitacaoIn(In):
    numero: str | None = Field(None, max_length=60)
    orgao_id: int | None = None
    orgao_nome: str | None = Field(None, max_length=255)
    orgao_cnpj: str | None = Field(None, max_length=20)
    modalidade: str | None = Field(None, max_length=80)
    criterio_julgamento: str | None = Field(None, max_length=80)
    objeto: str = Field(min_length=3)
    uf: str | None = Field(None, max_length=2)
    municipio: str | None = Field(None, max_length=120)
    data_publicacao: datetime | None = None
    data_abertura: datetime | None = None
    data_encerramento_proposta: datetime | None = None
    valor_estimado: Money = Decimal("0")
    valor_proposta: Money = Decimal("0")
    status: STATUS = "prospeccao"
    responsavel: str | None = Field(None, max_length=150)
    link_edital: str | None = Field(None, max_length=500)
    link_sistema: str | None = Field(None, max_length=500)
    favorito: bool = False
    observacoes: str | None = None


class LicitacaoOut(Out, LicitacaoIn):
    pncp_controle: str | None = None


class MonitorIn(In):
    nome: str = Field(min_length=2, max_length=120)
    palavras_chave: str | None = Field(None, max_length=500)
    uf: str | None = Field(None, max_length=2)
    codigo_municipio_ibge: str | None = Field(None, max_length=10)
    modalidades: str | None = Field("6,4,5,8", max_length=100)
    ativo: bool = True


class MonitorOut(Out, MonitorIn):
    pass


class ImportarIn(BaseModel):
    item: dict


licitacoes = Crud(Licitacao, LicitacaoIn, LicitacaoOut, perm="licitacoes", entity="licitacao",
                  search=["objeto", "orgao_nome", "numero", "municipio"],
                  filters=["status", "uf", "modalidade", "favorito", "data_abertura"], order="-data_abertura")
monitores = Crud(MonitorPncp, MonitorIn, MonitorOut, perm="licitacoes", entity="pncp_monitor", order="nome")

r = APIRouter(prefix="/pncp", tags=["pncp"])


@r.get("/modalidades")
def modalidades(cu: CurrentUser = Depends(require("licitacoes.ver"))):
    return [{"codigo": k, "nome": v} for k, v in pncp.MODALIDADES.items()]


@r.get("/buscar")
def buscar(
    modalidade: int = Query(6, ge=1, le=13),
    modo: Literal["abertas", "publicadas"] = "abertas",
    uf: str | None = Query(None, max_length=2),
    municipio_ibge: str | None = Query(None, pattern=r"^\d{7}$"),
    palavras: str | None = Query(None, max_length=300),
    data_inicial: date | None = None,
    data_final: date | None = None,
    pagina: int = Query(1, ge=1, le=1000),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(require("licitacoes.ver")),
):
    if modo == "abertas":
        res = pncp.buscar_abertas(modalidade=modalidade, uf=uf, municipio_ibge=municipio_ibge, palavras=palavras,
                                  data_final=data_final, pagina=pagina)
    else:
        if not data_inicial or not data_final:
            raise HTTPException(422, "Informe data inicial e final")
        if (data_final - data_inicial).days > 365:
            raise HTTPException(422, "Período máximo de 365 dias")
        res = pncp.buscar_publicadas(modalidade=modalidade, data_inicial=data_inicial, data_final=data_final, uf=uf,
                                     municipio_ibge=municipio_ibge, palavras=palavras, pagina=pagina)
    ids = [i["pncp_controle"] for i in res["itens"] if i["pncp_controle"]]
    existentes = dict(db.execute(select(Licitacao.pncp_controle, Licitacao.id).where(Licitacao.pncp_controle.in_(ids))).all())
    for i in res["itens"]:
        i["licitacao_id"] = existentes.get(i["pncp_controle"])
    return res


CTRL = re.compile(r"^(\d{14})-\d-(\d+)/(\d{4})$")


def _parse_controle(ctrl: str) -> tuple[str, int, int]:
    m = CTRL.match(ctrl or "")
    if not m:
        raise HTTPException(422, "Número de controle PNCP inválido")
    return m.group(1), int(m.group(3)), int(m.group(2))


@r.get("/arquivos")
def arquivos(controle: str, cu: CurrentUser = Depends(require("licitacoes.ver"))):
    cnpj, ano, seq = _parse_controle(controle)
    return pncp.arquivos(cnpj, ano, seq)


@r.get("/itens")
def itens(controle: str, cu: CurrentUser = Depends(require("licitacoes.ver"))):
    cnpj, ano, seq = _parse_controle(controle)
    return pncp.itens(cnpj, ano, seq)


@r.post("/importar", response_model=LicitacaoOut, status_code=201)
def importar(body: ImportarIn, request: Request, db: Session = Depends(get_db),
             cu: CurrentUser = Depends(require("licitacoes.criar"))):
    i = body.item
    ctrl = i.get("pncp_controle")
    _parse_controle(ctrl)
    if (lic := db.scalar(select(Licitacao).where(Licitacao.pncp_controle == ctrl))) is not None:
        return lic
    data = LicitacaoIn.model_validate({k: i.get(k) for k in LicitacaoIn.model_fields if k in i and i.get(k) is not None})
    lic = Licitacao(**data.model_dump(), pncp_controle=ctrl, pncp_dados=i)
    db.add(lic)
    db.flush()
    audit.log(db, user_id=cu.id, action="importar_pncp", entity="licitacao", entity_id=lic.id,
              data={"controle": ctrl}, request=request)
    db.commit()
    return lic


@r.get("/monitores/{monitor_id}/executar")
def executar_monitor(monitor_id: int, db: Session = Depends(get_db),
                     cu: CurrentUser = Depends(require("licitacoes.ver"))):
    """Executa um monitor salvo (todas as modalidades configuradas, primeira página de cada)."""
    m = db.get(MonitorPncp, monitor_id)
    if not m:
        raise HTTPException(404, "Monitor não encontrado")
    out: list[dict] = []
    erros: list[str] = []
    for cod in [int(c) for c in (m.modalidades or "6").split(",") if c.strip().isdigit()]:
        try:
            res = pncp.buscar_abertas(modalidade=cod, uf=m.uf, municipio_ibge=m.codigo_municipio_ibge,
                                      palavras=m.palavras_chave)
            out.extend(res["itens"])
        except HTTPException as e:
            erros.append(f"{pncp.MODALIDADES.get(cod, cod)}: {e.detail}")
    ids = [i["pncp_controle"] for i in out if i["pncp_controle"]]
    existentes = dict(db.execute(select(Licitacao.pncp_controle, Licitacao.id).where(Licitacao.pncp_controle.in_(ids))).all())
    for i in out:
        i["licitacao_id"] = existentes.get(i["pncp_controle"])
    return {"itens": out, "erros": erros}


module = ModuleDef(key="licitacoes", label="Licitações", icon="gavel", order=20,
                   routers=[r, licitacoes.router("/licitacoes"), monitores.router("/pncp-monitores")],
                   attachable={"licitacao": "licitacoes"}, template_entities={"licitacao": ("Licitação", Licitacao, "licitacoes.ver")})
module.crud_permissions(label="Licitações")
