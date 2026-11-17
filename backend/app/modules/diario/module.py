from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import audit
from app.core.crud import Crud
from app.core.database import SessionLocal, get_db
from app.core.deps import CurrentUser, require
from app.core.registry import ModuleDef

from . import service
from .models import DiarioObra
from .schemas import DiarioIn, DiarioOut

JSON_CAMPOS = ("clima_detalhe", "clima_atual", "efetivo", "equipamentos", "materiais", "atividades", "visitas_lista",
               "ocorrencias_lista", "pendencias", "providencias")


def _validate(db: Session, data: dict, obj, cu: CurrentUser) -> None:
    if obj is not None and obj.status == "fechado":
        raise HTTPException(409, "Diário fechado. Reabra para editar.")
    for k in JSON_CAMPOS:
        if k in data:
            data[k] = jsonable_encoder(data[k])
    dia = data.get("data") or (obj.data if obj else None)
    if obj is None:
        data["numero"] = service.proximo_numero(db, data["obra_id"])
        data["criado_por_id"] = cu.id
        if not data.get("responsavel"):
            data["responsavel"] = cu.user.nome
    if dia and dia > date.today():
        raise HTTPException(422, "Não é possível registrar diário em data futura")
    service.normalizar(data, dia)


def _after_save(db: Session, obj: DiarioObra, cu: CurrentUser) -> None:
    service.atualizar_servicos(db, obj.obra_id)


diarios = Crud(DiarioObra, DiarioIn, DiarioOut, perm="diario", entity="diario", obra_field="obra_id",
               search=["observacoes", "ocorrencias"], filters=["obra_id", "data", "status"], order="-data",
               validate=_validate, after_save=_after_save)

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
def modelo(obra_id: int, data: date | None = None, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("diario.criar"))):
    """Pré-preenchimento do novo diário a partir do anterior (equipe, máquinas, serviços em andamento e
    somente as pendências não resolvidas) + serviços do cronograma previstos para a data."""
    diarios.check_obra(db, cu, obra_id)
    return service.modelo_do_anterior(db, obra_id, data)


# ------------------------------------------------------------------ PDF e cartilha
@r.get("/{diario_id}/pdf")
def pdf(diario_id: int, timbrado: bool = False, db: Session = Depends(get_db),
        cu: CurrentUser = Depends(require("diario.ver"))):
    from .relatorio import pdf_diario

    d = diarios.get_or_404(db, cu, diario_id)
    return Response(pdf_diario(db, d, timbrado=timbrado), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="RDO-{d.numero:04d}-{d.data.isoformat()}.pdf"'})


class RegistrarIn(BaseModel):
    timbrado: bool = False


@r.post("/{diario_id}/documento", status_code=201)
def registrar(diario_id: int, body: RegistrarIn, request: Request, db: Session = Depends(get_db),
              cu: CurrentUser = Depends(require("diario.ver", "documentos.criar"))):
    """Gera o PDF do diário como documento emitido (numerado), pronto para assinatura no Documenso."""
    from app.modules.documentos import registro

    from .relatorio import pdf_diario

    d = diarios.get_or_404(db, cu, diario_id)
    doc = registro.reservar(db, tipo="relatorio", prefixo="RDO", titulo=f"Diário de obra {d.data:%d/%m/%Y} — {d.obra.nome}",
                            entidade="diario", entidade_id=d.id, obra_id=d.obra_id, user_id=cu.id)
    registro.concluir(db, doc, pdf_diario(db, d, timbrado=body.timbrado), cu.id)
    db.commit()
    return {"documento_id": doc.id, "numero": doc.numero}


class CartilhaIn(BaseModel):
    obra_id: int
    inicio: date
    fim: date
    formato: Literal["livreto", "a5", "a4"] = "livreto"
    fotos_por_dia: int | None = Field(None, ge=0, le=100)  # None = todas
    titulo: str = Field("Cartilha da obra", min_length=2, max_length=120)


def _gerar_cartilha(doc_id: int, body: dict, user_id: int, emitido_por: str) -> None:
    from app.modules.documentos import registro
    from app.modules.documentos.models import Documento
    from app.modules.obras.models import Obra

    from .relatorio import pdf_cartilha

    with SessionLocal() as db:
        doc = db.get(Documento, doc_id)
        try:
            obra = db.get(Obra, body["obra_id"])
            pdf = pdf_cartilha(db, obra, body["inicio"], body["fim"], formato=body["formato"],
                               fotos_por_dia=body["fotos_por_dia"], titulo=body["titulo"], emitido_por=emitido_por,
                               progresso=lambda t: registro.progresso(db, doc_id, t))
            registro.concluir(db, doc, pdf, user_id)
        except Exception as erro:  # noqa: BLE001
            db.rollback()
            doc = db.get(Documento, doc_id)
            registro.falhar(db, doc, erro)
        db.commit()


@r.post("/cartilha", status_code=202)
def cartilha(body: CartilhaIn, request: Request, tarefas: BackgroundTasks, db: Session = Depends(get_db),
             cu: CurrentUser = Depends(require("diario.ver", "documentos.criar"))):
    """Gera em segundo plano a cartilha (todos os diários do período) como documento. Acompanhe pelo documento."""
    from app.modules.documentos import registro
    from app.modules.obras.module import obras

    obra = obras.get_or_404(db, cu, body.obra_id)
    if body.fim < body.inicio:
        raise HTTPException(422, "A data final deve ser igual ou posterior à inicial")
    if (body.fim - body.inicio).days > 800:
        raise HTTPException(422, "Período máximo de 800 dias por cartilha")
    doc = registro.reservar(db, tipo="cartilha", prefixo="Cartilha",
                            titulo=f"{body.titulo} — {obra.nome} ({body.inicio:%d/%m/%Y} a {body.fim:%d/%m/%Y})",
                            entidade="obra", entidade_id=obra.id, obra_id=obra.id, user_id=cu.id)
    doc.variaveis = {"_progresso": "Na fila", "_parametros": body.model_dump(mode="json")}
    audit.log(db, user_id=cu.id, action="gerar_cartilha", entity="obra", entity_id=obra.id,
              data=body.model_dump(mode="json"), request=request)
    db.commit()
    tarefas.add_task(_gerar_cartilha, doc.id, body.model_dump(), cu.id, cu.user.nome)
    return {"documento_id": doc.id, "numero": doc.numero}


module = ModuleDef(key="diario", label="Diário de obras", icon="notebook", order=15,
                   routers=[r, diarios.router("/diarios")], attachable={"diario": "diario"},
                   template_entities={"diario": ("Diário de obra", DiarioObra, "diario.ver")})
module.crud_permissions(label="Diário de obras", extra={"fechar": "Fechar diário", "reabrir": "Reabrir diário fechado"})
