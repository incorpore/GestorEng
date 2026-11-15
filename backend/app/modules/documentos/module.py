import hmac
from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.crud import Crud
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.models import Arquivo
from app.core.registry import ModuleDef, registry
from app.core.schemas import In, Out
from app.modules.sistema.service import get_config, get_integracao

from . import documenso, pdf, render
from .models import Documento, ModeloDocumento

TIPOS = Literal["oficio", "boletim_medicao", "recibo", "declaracao", "contrato", "relatorio", "memorando",
                "proposta", "ata", "notificacao", "outro"]


class Margens(BaseModel):
    margem_superior: float = Field(ge=0, le=120)
    margem_inferior: float = Field(ge=0, le=120)
    margem_esquerda: float = Field(ge=0, le=120)
    margem_direita: float = Field(ge=0, le=120)


class ModeloIn(In):
    nome: str = Field(min_length=2, max_length=150)
    tipo: TIPOS = "outro"
    entidade: str | None = Field(None, max_length=40)
    conteudo: str = Field("", max_length=2_000_000)
    css: str | None = Field(None, max_length=50_000)
    usar_timbrado: bool = True
    orientacao: Literal["retrato", "paisagem"] = "retrato"
    margens: Margens | None = None
    prefixo_numero: str | None = Field(None, max_length=40)
    numerar: bool = True
    ativo: bool = True


class ModeloOut(Out, ModeloIn):
    pass


class DocumentoOut(Out):
    modelo_id: int | None
    tipo: str
    ano: int
    sequencial: int | None
    numero: str | None
    titulo: str
    data_emissao: date
    entidade: str | None
    entidade_id: int | None
    obra_id: int | None
    destinatario: str | None
    conteudo: str
    css: str | None
    usar_timbrado: bool
    orientacao: str
    margens: dict | None
    variaveis: dict | None
    status: str
    pdf_arquivo_id: int | None
    pdf_assinado_id: int | None
    documenso_id: str | None
    assinantes: list | None
    enviado_assinatura_em: datetime | None


class DocumentoEditIn(In):
    titulo: str | None = Field(None, max_length=255)
    destinatario: str | None = Field(None, max_length=255)
    data_emissao: date | None = None
    conteudo: str | None = Field(None, max_length=2_000_000)
    css: str | None = Field(None, max_length=50_000)
    usar_timbrado: bool | None = None
    orientacao: Literal["retrato", "paisagem"] | None = None
    margens: Margens | None = None
    variaveis: dict | None = None
    entidade: str | None = None
    entidade_id: int | None = None


class GerarIn(In):
    modelo_id: int | None = None
    tipo: TIPOS | None = None
    titulo: str = Field(min_length=2, max_length=255)
    entidade: str | None = Field(None, max_length=40)
    entidade_id: int | None = None
    destinatario: str | None = Field(None, max_length=255)
    data_emissao: date | None = None
    variaveis: dict | None = None
    conteudo: str | None = Field(None, max_length=2_000_000)


class PreviewIn(BaseModel):
    conteudo: str = Field(max_length=2_000_000)
    css: str | None = Field(None, max_length=50_000)
    entidade: str | None = None
    entidade_id: int | None = None
    variaveis: dict | None = None
    usar_timbrado: bool = True
    orientacao: Literal["retrato", "paisagem"] = "retrato"
    margens: Margens | None = None
    documento_id: int | None = None


def _modelo_validate(db, data, obj, cu):
    if data.get("entidade") and data["entidade"] not in registry.template_entities:
        raise HTTPException(422, "Entidade de contexto inválida")
    if "conteudo" in data:
        try:
            render.make_env().parse(data["conteudo"] or "")
        except Exception as e:  # noqa: BLE001
            raise HTTPException(422, f"Erro no modelo: {e}")


def _doc_validate(db, data, obj, cu):
    if obj is not None and obj.status != "rascunho":
        raise HTTPException(409, "Documento emitido não pode ser alterado. Cancele e gere um novo.")
    if data.get("entidade"):
        _check_entidade(cu, data["entidade"])


modelos = Crud(ModeloDocumento, ModeloIn, ModeloOut, perm="modelos", entity="modelo_documento", order="tipo,nome",
               search=["nome"], filters=["tipo", "ativo", "entidade"], validate=_modelo_validate)
documentos = Crud(Documento, DocumentoEditIn, DocumentoOut, perm="documentos", entity="documento",
                  obra_field="obra_id", search=["titulo", "numero", "destinatario"],
                  filters=["tipo", "status", "entidade", "entidade_id", "obra_id", "ano", "data_emissao"],
                  order="-data_emissao,-id", validate=_doc_validate, allow_create=False)
# criação é feita por /documentos-acoes/gerar (numeração e contexto)
r = APIRouter(prefix="/documentos-acoes", tags=["documento"])


def _check_entidade(cu: CurrentUser, entidade: str | None):
    if not entidade:
        return
    info = registry.template_entities.get(entidade)
    if not info:
        raise HTTPException(422, "Entidade de contexto inválida")
    if not cu.has(info[2]):
        raise HTTPException(403, f"Sem permissão para usar dados de {info[0]}")


def _obra_de(db: Session, entidade: str | None, entidade_id: int | None) -> int | None:
    if not entidade or not entidade_id:
        return None
    if entidade == "obra":
        return entidade_id
    info = registry.template_entities.get(entidade)
    obj = db.get(info[1], entidade_id) if info else None
    return getattr(obj, "obra_id", None) if obj is not None else None


def _timbrado(db: Session):
    cfg = get_config(db, "timbrado")

    def load(aid):
        a = db.get(Arquivo, aid) if aid else None
        return (storage.read_bytes(a.uuid), a.mime) if a else None

    return cfg, load(cfg.get("arquivo_id")), load(cfg.get("arquivo_continuacao_id"))


def _render_html(db: Session, cu: CurrentUser, conteudo: str, entidade, entidade_id, variaveis, doc=None) -> str:
    _check_entidade(cu, entidade)
    ctx = render.build_context(db, entidade=entidade, entidade_id=entidade_id, documento=doc, usuario=cu.user,
                               extras=variaveis)
    try:
        return render.render(conteudo or "", ctx)
    except render.RenderError as e:
        raise HTTPException(422, str(e))


def _make_pdf(db: Session, html: str, *, usar_timbrado: bool, orientacao: str, margens: dict | None, css: str | None,
              titulo: str) -> bytes:
    cfg, t1, t2 = _timbrado(db)
    return pdf.html_to_pdf(html, config=cfg, usar_timbrado=usar_timbrado and cfg.get("ativo", True), orientacao=orientacao,
                           margens=margens, css_extra=css, timbrado=t1, timbrado_cont=t2, titulo=titulo)


@r.get("/variaveis")
def variaveis(cu: CurrentUser = Depends(require("documentos.ver"))):
    return render.variables_catalog()


@r.post("/preview/html")
def preview_html(body: PreviewIn, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.ver"))):
    doc = db.get(Documento, body.documento_id) if body.documento_id else None
    if doc:
        documentos.check_obra(db, cu, doc.obra_id)
    return {"html": _render_html(db, cu, body.conteudo, body.entidade, body.entidade_id, body.variaveis, doc)}


@r.post("/preview/pdf")
def preview_pdf(body: PreviewIn, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.ver"))):
    doc = db.get(Documento, body.documento_id) if body.documento_id else None
    if doc:
        documentos.check_obra(db, cu, doc.obra_id)
    html = _render_html(db, cu, body.conteudo, body.entidade, body.entidade_id, body.variaveis, doc)
    data = _make_pdf(db, html, usar_timbrado=body.usar_timbrado, orientacao=body.orientacao,
                     margens=body.margens.model_dump() if body.margens else None, css=body.css, titulo="Pré-visualização")
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": "inline; filename=preview.pdf"})


def _proximo_numero(db: Session, tipo: str, ano: int) -> int:
    return (db.scalar(select(func.max(Documento.sequencial)).where(Documento.tipo == tipo, Documento.ano == ano)) or 0) + 1


@r.post("/gerar", response_model=DocumentoOut, status_code=201)
def gerar(body: GerarIn, request: Request, db: Session = Depends(get_db),
          cu: CurrentUser = Depends(require("documentos.criar"))):
    modelo = db.get(ModeloDocumento, body.modelo_id) if body.modelo_id else None
    if body.modelo_id and not modelo:
        raise HTTPException(404, "Modelo não encontrado")
    tipo = body.tipo or (modelo.tipo if modelo else "outro")
    entidade = body.entidade or (modelo.entidade if modelo else None)
    _check_entidade(cu, entidade)
    obra_id = _obra_de(db, entidade, body.entidade_id)
    documentos.check_obra(db, cu, obra_id)
    emissao = body.data_emissao or date.today()
    numerar = modelo.numerar if modelo else True
    prefixo = (modelo.prefixo_numero if modelo else None) or tipo.replace("_", " ").title()
    for _ in range(5):
        seq = _proximo_numero(db, tipo, emissao.year) if numerar else None
        doc = Documento(
            modelo_id=modelo.id if modelo else None, tipo=tipo, ano=emissao.year, sequencial=seq,
            numero=f"{prefixo} {seq:03d}/{emissao.year}" if seq else None, titulo=body.titulo, data_emissao=emissao,
            entidade=entidade, entidade_id=body.entidade_id, obra_id=obra_id, destinatario=body.destinatario,
            conteudo=body.conteudo if body.conteudo is not None else (modelo.conteudo if modelo else ""),
            css=modelo.css if modelo else None, usar_timbrado=modelo.usar_timbrado if modelo else True,
            orientacao=modelo.orientacao if modelo else "retrato", margens=modelo.margens if modelo else None,
            variaveis=body.variaveis or {}, criado_por_id=cu.id,
        )
        db.add(doc)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
    else:
        raise HTTPException(409, "Não foi possível reservar numeração; tente novamente")
    audit.log(db, user_id=cu.id, action="criar", entity="documento", entity_id=doc.id, data={"numero": doc.numero},
              request=request)
    db.commit()
    return doc


def _get_doc(db, cu, did) -> Documento:
    return documentos.get_or_404(db, cu, did)


@r.get("/{did}/pdf")
def visualizar(did: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.ver"))):
    doc = _get_doc(db, cu, did)
    if doc.pdf_assinado_id or doc.pdf_arquivo_id:
        a = db.get(Arquivo, doc.pdf_assinado_id or doc.pdf_arquivo_id)
        data = storage.read_bytes(a.uuid)
    else:
        html = _render_html(db, cu, doc.conteudo, doc.entidade, doc.entidade_id, doc.variaveis, doc)
        data = _make_pdf(db, html, usar_timbrado=doc.usar_timbrado, orientacao=doc.orientacao, margens=doc.margens,
                         css=doc.css, titulo=doc.titulo)
    nome = (doc.numero or doc.titulo).replace("/", "-")
    from urllib.parse import quote

    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(nome)}.pdf"})


@r.post("/{did}/emitir", response_model=DocumentoOut)
def emitir(did: int, request: Request, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("documentos.emitir"))):
    """Congela o conteúdo (variáveis resolvidas) e gera o PDF definitivo."""
    doc = _get_doc(db, cu, did)
    if doc.status != "rascunho":
        raise HTTPException(409, "Documento já emitido")
    html = _render_html(db, cu, doc.conteudo, doc.entidade, doc.entidade_id, doc.variaveis, doc)
    data = _make_pdf(db, html, usar_timbrado=doc.usar_timbrado, orientacao=doc.orientacao, margens=doc.margens,
                     css=doc.css, titulo=doc.titulo)
    nome = f"{(doc.numero or doc.titulo).replace('/', '-')}.pdf"
    meta = storage.save_bytes(data, nome, mime="application/pdf")
    a = Arquivo(**meta, entidade="documento", entidade_id=doc.id, enviado_por_id=cu.id)
    db.add(a)
    db.flush()
    # conteúdo congelado: escapa chaves remanescentes para não serem reinterpretadas
    doc.conteudo = "{% raw %}" + html.replace("{% endraw %}", "") + "{% endraw %}"
    doc.pdf_arquivo_id = a.id
    doc.status = "emitido"
    audit.log(db, user_id=cu.id, action="emitir", entity="documento", entity_id=doc.id, data={"sha256": meta["sha256"]},
              request=request)
    db.commit()
    db.refresh(doc)
    return doc


@r.post("/{did}/cancelar", response_model=DocumentoOut)
def cancelar(did: int, request: Request, db: Session = Depends(get_db),
             cu: CurrentUser = Depends(require("documentos.emitir"))):
    doc = _get_doc(db, cu, did)
    doc.status = "cancelado"
    audit.log(db, user_id=cu.id, action="cancelar", entity="documento", entity_id=doc.id, request=request)
    db.commit()
    db.refresh(doc)
    return doc


class Assinante(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: EmailStr
    papel: Literal["SIGNER", "APPROVER", "VIEWER", "CC"] = "SIGNER"


class AssinaturaIn(BaseModel):
    assinantes: list[Assinante] = Field(min_length=1, max_length=20)
    mensagem: str | None = Field(None, max_length=2000)


@r.post("/{did}/assinatura", response_model=DocumentoOut)
def enviar_assinatura(did: int, body: AssinaturaIn, request: Request, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("documentos.assinar"))):
    doc = _get_doc(db, cu, did)
    if doc.status != "emitido" or not doc.pdf_arquivo_id:
        raise HTTPException(409, "Emita o documento antes de enviar para assinatura")
    a = db.get(Arquivo, doc.pdf_arquivo_id)
    res = documenso.enviar(db, titulo=f"{doc.numero or ''} {doc.titulo}".strip(), pdf=storage.read_bytes(a.uuid),
                           assinantes=[x.model_dump() for x in body.assinantes], mensagem=body.mensagem)
    doc.documenso_id = res["documento_id"]
    doc.assinantes = res["assinantes"]
    doc.status = "aguardando_assinatura"
    doc.enviado_assinatura_em = datetime.now(UTC)
    audit.log(db, user_id=cu.id, action="enviar_assinatura", entity="documento", entity_id=doc.id,
              data={"documenso_id": doc.documenso_id, "assinantes": [x.email for x in body.assinantes]}, request=request)
    db.commit()
    db.refresh(doc)
    return doc


def _sincronizar(db: Session, doc: Documento, user_id: int | None = None) -> None:
    info = documenso.status(db, doc.documenso_id)
    recs = info.get("recipients") or info.get("Recipient") or []
    if recs:
        doc.assinantes = [{"nome": x.get("name"), "email": x.get("email"), "status": x.get("signingStatus"),
                           "assinado_em": x.get("signedAt")} for x in recs]
    st = (info.get("status") or "").upper()
    if st == "COMPLETED" and not doc.pdf_assinado_id:
        data = documenso.baixar_assinado(db, doc.documenso_id)
        meta = storage.save_bytes(data, f"{(doc.numero or doc.titulo).replace('/', '-')}-assinado.pdf", mime="application/pdf")
        a = Arquivo(**meta, entidade="documento", entidade_id=doc.id, enviado_por_id=user_id)
        db.add(a)
        db.flush()
        doc.pdf_assinado_id = a.id
        doc.status = "assinado"
    elif st in ("REJECTED", "CANCELLED"):
        doc.status = "assinatura_recusada"


@r.post("/{did}/assinatura/sincronizar", response_model=DocumentoOut)
def sincronizar(did: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.ver"))):
    doc = _get_doc(db, cu, did)
    if not doc.documenso_id:
        raise HTTPException(409, "Documento não enviado para assinatura")
    _sincronizar(db, doc, cu.id)
    db.commit()
    db.refresh(doc)
    return doc


@r.post("/integracao/documenso/testar")
def testar_documenso(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("configuracoes.editar"))):
    return documenso.testar(db)


wh = APIRouter(prefix="/webhooks", tags=["webhooks"])


@wh.post("/documenso", status_code=204)
async def webhook_documenso(request: Request, x_documenso_secret: str | None = Header(None),
                            db: Session = Depends(get_db)):
    cfg, _ = get_integracao(db, "documenso")
    secret = cfg.get("webhook_secret")
    if not secret or not x_documenso_secret or not hmac.compare_digest(secret, x_documenso_secret):
        raise HTTPException(401, "Assinatura do webhook inválida")
    payload = await request.json()
    doc_id = str((payload.get("payload") or {}).get("id") or "")
    if not doc_id:
        return
    doc = db.scalar(select(Documento).where(Documento.documenso_id == doc_id))
    if doc:
        try:
            _sincronizar(db, doc)
            audit.log(db, user_id=None, action="webhook_documenso", entity="documento", entity_id=doc.id,
                      data={"evento": payload.get("event")})
            db.commit()
        except HTTPException:
            db.rollback()


module = ModuleDef(key="documentos", label="Documentos", icon="file-text", order=35,
                   routers=[r, wh, documentos.router("/documentos"), modelos.router("/modelos-documento")])
module.crud_permissions(label="Documentos", extra={"emitir": "Emitir/cancelar documentos",
                                                     "assinar": "Enviar para assinatura (Documenso)"})
module.crud_permissions("modelos", "Modelos de documento")
