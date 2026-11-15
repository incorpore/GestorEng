from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef
from app.core.schemas import In, Out

from .models import DiarioObra

CLIMA = Literal["bom", "nublado", "chuvoso", "impraticavel"] | None


class Efetivo(BaseModel):
    funcao: str = Field(max_length=100)
    quantidade: int = Field(ge=0, le=10000)
    empresa: str | None = Field("propria", max_length=100)


class Equip(BaseModel):
    descricao: str = Field(max_length=200)
    quantidade: int = Field(1, ge=0, le=10000)
    horas: float | None = Field(None, ge=0, le=24)


class Atividade(BaseModel):
    descricao: str = Field(max_length=1000)
    local: str | None = Field(None, max_length=200)
    situacao: Literal["iniciada", "em_andamento", "concluida", "paralisada"] = "em_andamento"
    percentual: float | None = Field(None, ge=0, le=100)


class DiarioIn(In):
    obra_id: int
    data: date
    clima_manha: CLIMA = "bom"
    clima_tarde: CLIMA = "bom"
    clima_noite: CLIMA = None
    condicao: Literal["praticavel", "parcial", "impraticavel"] = "praticavel"
    temperatura: str | None = Field(None, max_length=20)
    efetivo: list[Efetivo] = []
    equipamentos: list[Equip] = []
    atividades: list[Atividade] = []
    materiais_recebidos: str | None = None
    ocorrencias: str | None = None
    visitas: str | None = None
    observacoes: str | None = None
    responsavel: str | None = Field(None, max_length=150)


class DiarioOut(Out, DiarioIn):
    numero: int
    status: str
    obra_nome: str | None = None
    total_efetivo: int = 0
    fechado_em: datetime | None = None


def _validate(db: Session, data: dict, obj, cu: CurrentUser) -> None:
    if obj is not None and obj.status == "fechado":
        raise HTTPException(409, "Diário fechado. Reabra para editar.")
    if obj is None:
        n = db.scalar(select(func.max(DiarioObra.numero)).where(DiarioObra.obra_id == data["obra_id"]))
        data["numero"] = (n or 0) + 1
        data["criado_por_id"] = cu.id
        if not data.get("responsavel"):
            data["responsavel"] = cu.user.nome
    if data.get("data") and data["data"] > date.today():
        raise HTTPException(422, "Não é possível registrar diário em data futura")


diarios = Crud(DiarioObra, DiarioIn, DiarioOut, perm="diario", entity="diario", obra_field="obra_id",
               search=["observacoes", "ocorrencias"], filters=["obra_id", "data", "status"], order="-data",
               validate=_validate)

r = APIRouter(prefix="/diarios-acoes", tags=["diario"])


@r.post("/{diario_id}/fechar", response_model=DiarioOut)
def fechar(diario_id: int, request: Request, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("diario.fechar"))):
    d = diarios.get_or_404(db, cu, diario_id)
    d.status, d.fechado_por_id, d.fechado_em = "fechado", cu.id, datetime.now(UTC)
    audit.log(db, user_id=cu.id, action="fechar", entity="diario", entity_id=d.id, request=request)
    db.commit()
    return d


@r.post("/{diario_id}/reabrir", response_model=DiarioOut)
def reabrir(diario_id: int, request: Request, db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require("diario.reabrir"))):
    d = diarios.get_or_404(db, cu, diario_id)
    d.status, d.fechado_por_id, d.fechado_em = "aberto", None, None
    audit.log(db, user_id=cu.id, action="reabrir", entity="diario", entity_id=d.id, request=request)
    db.commit()
    return d


@r.get("/modelo")
def modelo(obra_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("diario.criar"))):
    """Retorna o último diário da obra para pré-preencher efetivo/equipamentos/atividades."""
    diarios.check_obra(db, cu, obra_id)
    d = db.scalar(select(DiarioObra).where(DiarioObra.obra_id == obra_id).order_by(DiarioObra.data.desc()).limit(1))
    if not d:
        return {}
    return {"efetivo": d.efetivo, "equipamentos": d.equipamentos,
            "atividades": [a for a in d.atividades if a.get("situacao") != "concluida"]}


module = ModuleDef(key="diario", label="Diário de obras", icon="notebook", order=15,
                   routers=[r, diarios.router("/diarios")], attachable={"diario": "diario"},
                   template_entities={"diario": ("Diário de obra", DiarioObra, "diario.ver")})
module.crud_permissions(label="Diário de obras", extra={"fechar": "Fechar diário", "reabrir": "Reabrir diário fechado"})
