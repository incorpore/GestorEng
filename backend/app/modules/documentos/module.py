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
from app.core.deps import CurrentUser, get_current_user, require
from app.core.models import Arquivo
from app.core.registry import ModuleDef, registry
from app.core.schemas import In, Out
from app.modules.sistema.service import get_config, get_integracao

from . import documenso, pdf, render
from .models import Documento, ModeloDocumento

TIPOS = Literal["oficio", "boletim_medicao", "recibo", "declaracao", "contrato", "relatorio", "memorando",
                "proposta", "ata", "notificacao", "cartilha", "outro"]


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
    if doc.status in ("gerando", "erro"):
        raise HTTPException(409, "O PDF ainda está sendo gerado" if doc.status == "gerando" else "Falha ao gerar este documento")
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
    sequencial: bool = True  # cada assinante recebe depois que o anterior assinar, na ordem da lista
    pasta_id: str | None = Field(None, max_length=64)  # pasta escolhida no Documenso
    pasta_auto: bool = True  # sem pasta escolhida: usa o padrão (ERP/Cliente/Obra/Documentos|Anexos)
    campos: list["CampoAssinatura"] | None = Field(None, max_length=60)  # posições detectadas/ajustadas


class CampoAssinatura(BaseModel):
    indice: int = Field(ge=0, le=19)
    pagina: int = Field(ge=1, le=2000)
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    largura: float = Field(ge=2, le=100)
    altura: float = Field(ge=1, le=50)


AssinaturaIn.model_rebuild()


class DetectarIn(BaseModel):
    assinantes: list[Assinante] = Field(min_length=1, max_length=20)
    usar_ia: bool = True


def caminho_auto(db: Session, doc: Documento) -> list[str]:
    """Pastas padrão do documento no Documenso, conforme o modelo configurado na integração."""
    from app.modules.obras.models import Obra

    cfg, _ = get_integracao(db, "documenso")
    modelo = (cfg.get("pasta_padrao") or "").strip() or documenso.PASTA_PADRAO
    obra = db.get(Obra, doc.obra_id) if doc.obra_id else None
    cli = obra.cliente if obra else None
    valores = {"cliente": (cli.nome_fantasia or cli.nome) if cli else "Sem cliente", "obra": obra.nome if obra else "Sem obra",
               "tipo": "Anexos" if doc.tipo == "anexo" else "Documentos", "ano": str(doc.ano or date.today().year),
               "documento": doc.titulo or ""}
    for k, v in valores.items():
        modelo = modelo.replace("{{" + k + "}}", documenso.nome_pasta(v) or "-").replace("{{ " + k + " }}", documenso.nome_pasta(v) or "-")
    return [p for p in (documenso.nome_pasta(x) for x in modelo.split("/")) if p][:8]


def nome_pdf(db: Session, doc: Documento) -> str:
    """Nome do documento no Documenso: o nome do arquivo (anexos) ou 'número - título.pdf'."""
    anexo_id = (doc.variaveis or {}).get("_anexo_id")
    a = db.get(Arquivo, anexo_id) if anexo_id else None
    nome = a.nome if a else " - ".join(x for x in (doc.numero, doc.titulo) if x)
    nome = nome.replace("/", "-").strip() or "documento"
    return (nome if nome.lower().endswith(".pdf") else f"{nome}.pdf")[:240]


def _representante(db: Session) -> dict:
    from app.modules.sistema.service import get_config

    e = get_config(db, "empresa")
    return {"nome": (e.get("responsavel") or "").strip(), "email": (e.get("email_responsavel") or "").strip(),
            "cargo": e.get("cargo_responsavel") or ""}


class PastaIn(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    parent_id: str | None = Field(None, max_length=64)


@r.get("/documenso/pastas")
def listar_pastas(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.assinar"))):
    return documenso.pastas(db)


@r.post("/documenso/pastas", status_code=201)
def nova_pasta(body: PastaIn, request: Request, db: Session = Depends(get_db),
               cu: CurrentUser = Depends(require("documentos.assinar"))):
    p = documenso.criar_pasta(db, body.nome.strip(), body.parent_id)
    audit.log(db, user_id=cu.id, action="criar_pasta_documenso", entity="documento", data=p, request=request)
    db.commit()
    return p


# ------------------------------------------------------------------ assinatura de arquivos anexados
@r.get("/anexos")
def anexos_assinatura(entidade: str, entidade_id: int, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(get_current_user)):
    """Situação de assinatura dos PDFs anexados a um registro (arquivo_id → documento)."""
    from app.modules.sistema.arquivos import check_access

    check_access(db, cu, entidade, entidade_id, write=False)
    docs = db.scalars(select(Documento).where(Documento.tipo == "anexo", Documento.entidade == entidade,
                                              Documento.entidade_id == entidade_id, Documento.status != "cancelado"))
    return [{"arquivo_id": (d.variaveis or {}).get("_anexo_id"), "documento_id": d.id, "numero": d.numero,
             "status": d.status, "assinantes": d.assinantes} for d in docs]


@r.post("/anexos/{arquivo_id}", status_code=201)
def preparar_anexo(arquivo_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("documentos.assinar"))):
    """Registra um PDF anexado como documento (numerado) para enviar à assinatura. Idempotente."""
    from app.modules.sistema.arquivos import check_access, obra_da_entidade

    from . import registro

    a = db.get(Arquivo, arquivo_id)
    if not a or a.entidade in (None, "documento"):
        raise HTTPException(404, "Arquivo não encontrado")
    check_access(db, cu, a.entidade, a.entidade_id, write=True)
    if a.mime != "application/pdf":
        raise HTTPException(415, "Só arquivos PDF podem ser assinados")
    for d in db.scalars(select(Documento).where(Documento.tipo == "anexo", Documento.entidade == a.entidade,
                                                Documento.entidade_id == a.entidade_id, Documento.status != "cancelado")):
        if (d.variaveis or {}).get("_anexo_id") == a.id:
            return {"documento_id": d.id, "numero": d.numero, "status": d.status}
    titulo = a.nome[:-4] if a.nome.lower().endswith(".pdf") else a.nome
    doc = registro.reservar(db, tipo="anexo", prefixo="Anexo", titulo=(a.descricao or titulo)[:200], entidade=a.entidade,
                            entidade_id=a.entidade_id, obra_id=obra_da_entidade(db, a.entidade, a.entidade_id),
                            user_id=cu.id)
    registro.concluir(db, doc, storage.read_bytes(a.uuid), cu.id)
    doc.variaveis = {**(doc.variaveis or {}), "_anexo_id": a.id}
    db.commit()
    return {"documento_id": doc.id, "numero": doc.numero, "status": doc.status}


@r.get("/assinatura/padrao")
def assinatura_padrao(documento_id: int | None = None, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("documentos.assinar"))):
    """Representante legal (assinante obrigatório), pessoas usadas recentemente e — com documento_id — a pasta
    padrão e o nome com que o documento aparecerá no Documenso."""
    rep = _representante(db)
    destino = {}
    if documento_id:
        doc = _get_doc(db, cu, documento_id)
        destino = {"pasta_auto": caminho_auto(db, doc), "nome": nome_pdf(db, doc)}
    vistos, recentes = {rep["email"].lower()}, []
    for lista in db.scalars(select(Documento.assinantes).where(Documento.assinantes.is_not(None))
                            .order_by(Documento.enviado_assinatura_em.desc().nulls_last()).limit(60)):
        for a in lista or []:
            email = (a.get("email") or "").lower()
            if email and email not in vistos and a.get("nome"):
                vistos.add(email)
                recentes.append({"nome": a["nome"], "email": a["email"]})
    return {"representante": rep, "recentes": recentes[:30], **destino}


@r.post("/{did}/assinatura/detectar")
def detectar_campos(did: int, body: DetectarIn, request: Request, db: Session = Depends(get_db),
                    cu: CurrentUser = Depends(require("documentos.assinar"))):
    """Localiza onde cada assinante deve assinar no PDF (IA configurada + leitura do texto do PDF)."""
    from . import campos

    doc = _get_doc(db, cu, did)
    if not doc.pdf_arquivo_id:
        raise HTTPException(409, "Emita o documento antes de posicionar as assinaturas")
    a = db.get(Arquivo, doc.pdf_arquivo_id)
    chamar = None
    if body.usar_ia and cu.has("ia.usar") and get_integracao(db, "openrouter")[1]:
        from app.modules.ia.module import _call

        def chamar(msgs):
            return _call(db, msgs, max_tokens=2500)
    res = campos.detectar(storage.read_bytes(a.uuid), [x.model_dump() for x in body.assinantes], chamar)
    audit.log(db, user_id=cu.id, action="detectar_assinaturas", entity="documento", entity_id=doc.id,
              data={"metodo": res["metodo"], "encontrados": len(res["campos"])}, request=request)
    db.commit()
    return res


@r.post("/{did}/assinatura", response_model=DocumentoOut)
def enviar_assinatura(did: int, body: AssinaturaIn, request: Request, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("documentos.assinar"))):
    doc = _get_doc(db, cu, did)
    if doc.status != "emitido" or not doc.pdf_arquivo_id:
        raise HTTPException(409, "Emita o documento antes de enviar para assinatura")
    rep = _representante(db)
    if not rep["nome"] or not rep["email"]:
        raise HTTPException(400, "Cadastre o nome e o e-mail do representante legal em Configurações › Empresa")
    emails = [x.email.lower() for x in body.assinantes]
    if len(set(emails)) != len(emails):
        raise HTTPException(422, "Há assinantes com o mesmo e-mail")
    if not any(x.email.lower() == rep["email"].lower() and x.papel == "SIGNER" for x in body.assinantes):
        raise HTTPException(422, f"O representante legal ({rep['nome']}) deve estar entre os assinantes")
    a = db.get(Arquivo, doc.pdf_arquivo_id)
    pasta_id, aviso_pasta = body.pasta_id, None
    if not pasta_id and body.pasta_auto:
        try:
            pasta_id = documenso.garantir_caminho(db, caminho_auto(db, doc))
        except documenso.DocumensoFora:
            raise  # sem conexão: não adianta tentar enviar
        except HTTPException as e:  # o envio segue, apenas fora da pasta padrão
            aviso_pasta = f"Enviado, mas sem organizar em pastas: {e.detail}"
    res = documenso.enviar(db, titulo=nome_pdf(db, doc), pdf=storage.read_bytes(a.uuid),
                           assinantes=[x.model_dump() for x in body.assinantes], mensagem=body.mensagem,
                           sequencial=body.sequencial, pasta_id=pasta_id,
                           posicoes=[c.model_dump() for c in body.campos] if body.campos else None)
    res["aviso"] = res.get("aviso") or aviso_pasta
    doc.documenso_id = res["documento_id"]
    doc.assinantes = res["assinantes"]
    doc.status = "aguardando_assinatura"
    doc.enviado_assinatura_em = datetime.now(UTC)
    doc.variaveis = {**(doc.variaveis or {}), "_pasta_documenso": pasta_id, "_aviso_assinatura": res.get("aviso")}
    audit.log(db, user_id=cu.id, action="enviar_assinatura", entity="documento", entity_id=doc.id,
              data={"documenso_id": doc.documenso_id, "assinantes": [x.email for x in body.assinantes],
                    "pasta": pasta_id}, request=request)
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
