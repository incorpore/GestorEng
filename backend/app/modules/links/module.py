"""Links públicos (sem login) para visualizar diários e pedir fotos.

Cada acesso é registrado com IP, navegador e — quando o visitante autoriza — as coordenadas do aparelho.
Links podem exigir a localização para liberar o conteúdo/envio (padrão). Navegadores só fornecem localização
em páginas HTTPS.
"""
import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit, imagens, storage
from app.core.config import get_settings
from app.core.crypto import decrypt, encrypt
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.models import Arquivo
from app.core.ratelimit import RateLimiter
from app.core.registry import ModuleDef
from app.core.scope import allowed_obra_ids
from app.core.security import ALGORITHM, sha256

from .models import AcessoLink, LinkPublico

admin = APIRouter(prefix="/links-publicos", tags=["links públicos"])
pub = APIRouter(prefix="/publico/l", tags=["links públicos"])
limite_pub = RateLimiter(limit=90, window_seconds=60)
limite_envio = RateLimiter(limit=40, window_seconds=600)
PERM = {"diario": ("diario.ver", "diario.editar"), "obra": ("obras.ver", "obras.editar")}


# ------------------------------------------------------------------ utilidades
def _obra_id(db: Session, entidade: str, entidade_id: int) -> int:
    if entidade == "obra":
        from app.modules.obras.models import Obra

        if not db.get(Obra, entidade_id):
            raise HTTPException(404, "Obra não encontrada")
        return entidade_id
    from app.modules.diario.models import DiarioObra

    d = db.get(DiarioObra, entidade_id)
    if not d:
        raise HTTPException(404, "Diário não encontrado")
    return d.obra_id


def _checar(db: Session, cu: CurrentUser, entidade: str, obra_id: int, escrita: bool) -> None:
    if entidade not in PERM:
        raise HTTPException(422, "Entidade inválida")
    if not cu.has(PERM[entidade][1 if escrita else 0]):
        raise HTTPException(403, "Permissão insuficiente")
    ids = allowed_obra_ids(db, cu)
    if ids is not None and obra_id not in ids:
        raise HTTPException(403, "Sem acesso a esta obra")


def _url(link: LinkPublico) -> str | None:
    tok = decrypt(link.token_cifrado)
    return f"/p/{tok}" if tok else None


def _registrar(db: Session, link: LinkPublico, request: Request, evento: str, **kw) -> AcessoLink:
    a = AcessoLink(link_id=link.id, evento=evento, ip=audit.client_ip(request),
                   user_agent=(request.headers.get("user-agent") or "")[:300], **kw)
    db.add(a)
    return a


def _link(db: Session, token: str) -> LinkPublico:
    if not token or len(token) > 100:
        raise HTTPException(404, "Link inválido")
    link = db.scalar(select(LinkPublico).where(LinkPublico.token_hash == sha256(token)))
    if not link:
        raise HTTPException(404, "Link inválido")
    if not link.ativo:
        raise HTTPException(410, "Este link foi desativado")
    if link.expira_em < datetime.now(UTC):
        raise HTTPException(410, "Este link expirou")
    return link


def _sessao(link: LinkPublico, localizacao: bool) -> str:
    agora = datetime.now(UTC)
    return jwt.encode({"typ": "link", "lid": link.id, "loc": localizacao, "iat": agora, "exp": agora + timedelta(hours=4)},
                      get_settings().secret_key, algorithm=ALGORITHM)


def _validar_sessao(link: LinkPublico, sessao: str | None) -> dict:
    try:
        dados = jwt.decode(sessao or "", get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sessão expirada. Abra o link novamente.")
    if dados.get("typ") != "link" or dados.get("lid") != link.id:
        raise HTTPException(401, "Sessão inválida")
    if link.exige_localizacao and not dados.get("loc"):
        raise HTTPException(403, "É necessário permitir a localização para continuar")
    return dados


# ------------------------------------------------------------------ administração (com login)
class LinkIn(BaseModel):
    tipo: Literal["visualizar", "fotos"]
    entidade: Literal["diario", "obra"]
    entidade_id: int
    titulo: str | None = Field(None, max_length=200)
    instrucoes: str | None = Field(None, max_length=2000)
    destinatario: str | None = Field(None, max_length=150)
    validade_dias: int = Field(7, ge=1, le=180)
    exige_localizacao: bool = True
    max_fotos: int | None = Field(None, ge=1, le=500)


def _link_out(db: Session, link: LinkPublico) -> dict:
    ultimo = db.scalar(select(func.max(AcessoLink.at)).where(AcessoLink.link_id == link.id))
    total = db.scalar(select(func.count()).where(AcessoLink.link_id == link.id, AcessoLink.evento == "abriu"))
    fotos = db.scalar(select(func.count()).where(Arquivo.link_id == link.id))
    return {"id": link.id, "url": _url(link), "tipo": link.tipo, "entidade": link.entidade,
            "entidade_id": link.entidade_id, "titulo": link.titulo, "instrucoes": link.instrucoes,
            "destinatario": link.destinatario, "exige_localizacao": link.exige_localizacao, "max_fotos": link.max_fotos,
            "expira_em": link.expira_em, "ativo": link.ativo and link.expira_em >= datetime.now(UTC),
            "created_at": link.created_at, "acessos": total, "fotos_recebidas": fotos, "ultimo_acesso": ultimo}


@admin.post("", status_code=201)
def criar(body: LinkIn, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    obra_id = _obra_id(db, body.entidade, body.entidade_id)
    _checar(db, cu, body.entidade, obra_id, escrita=True)
    token = secrets.token_urlsafe(24)
    titulo = body.titulo or ("Envio de fotos" if body.tipo == "fotos" else "Diário de obra")
    link = LinkPublico(token_hash=sha256(token), token_cifrado=encrypt(token), tipo=body.tipo, entidade=body.entidade,
                       entidade_id=body.entidade_id, obra_id=obra_id, titulo=titulo, instrucoes=body.instrucoes,
                       destinatario=body.destinatario, exige_localizacao=body.exige_localizacao, max_fotos=body.max_fotos,
                       expira_em=datetime.now(UTC) + timedelta(days=body.validade_dias), criado_por_id=cu.id)
    db.add(link)
    db.flush()
    audit.log(db, user_id=cu.id, action="criar_link_publico", entity=body.entidade, entity_id=body.entidade_id,
              data={"link": link.id, "tipo": body.tipo, "validade_dias": body.validade_dias}, request=request)
    db.commit()
    return _link_out(db, link)


@admin.get("")
def listar(entidade: str | None = None, entidade_id: int | None = None, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(get_current_user)):
    q = select(LinkPublico).order_by(LinkPublico.id.desc()).limit(200)
    if entidade and entidade_id:
        _checar(db, cu, entidade, _obra_id(db, entidade, entidade_id), escrita=False)
        q = q.where(LinkPublico.entidade == entidade, LinkPublico.entidade_id == entidade_id)
    elif not cu.has("auditoria.ver"):
        raise HTTPException(403, "Permissão insuficiente")
    return [_link_out(db, link) for link in db.scalars(q)]


@admin.get("/{link_id}/acessos")
def acessos(link_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    link = db.get(LinkPublico, link_id) or _404()
    _checar(db, cu, link.entidade, link.obra_id, escrita=False)
    return [{"id": a.id, "at": a.at, "evento": a.evento, "ip": a.ip, "user_agent": a.user_agent, "latitude": a.latitude,
             "longitude": a.longitude, "precisao": a.precisao, "nome": a.nome, "detalhes": a.detalhes}
            for a in db.scalars(select(AcessoLink).where(AcessoLink.link_id == link_id).order_by(AcessoLink.id.desc()).limit(1000))]


@admin.post("/{link_id}/desativar")
def desativar(link_id: int, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    link = db.get(LinkPublico, link_id) or _404()
    _checar(db, cu, link.entidade, link.obra_id, escrita=True)
    link.ativo = False
    audit.log(db, user_id=cu.id, action="desativar_link_publico", entity=link.entidade, entity_id=link.entidade_id,
              data={"link": link.id}, request=request)
    db.commit()
    return _link_out(db, link)


# ------------------------------------------------------------------ público (sem login)
@pub.get("/{token}", dependencies=[Depends(limite_pub)])
def abrir(token: str, request: Request, db: Session = Depends(get_db)):
    from app.modules.obras.models import Obra
    from app.modules.sistema.service import get_config

    link = _link(db, token)
    _registrar(db, link, request, "abriu")
    db.commit()
    obra = db.get(Obra, link.obra_id)
    empresa = get_config(db, "empresa")
    return {"tipo": link.tipo, "titulo": link.titulo, "instrucoes": link.instrucoes, "destinatario": link.destinatario,
            "exige_localizacao": link.exige_localizacao, "expira_em": link.expira_em,
            "obra": {"nome": obra.nome, "cidade": obra.cidade, "uf": obra.uf} if obra else None,
            "empresa": {"nome": empresa.get("nome_fantasia") or empresa.get("razao_social"),
                        "cor": empresa.get("cor_primaria"), "tem_logo": bool(empresa.get("logo_arquivo_id"))}}


class LocalizacaoIn(BaseModel):
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    precisao: float | None = Field(None, ge=0, le=1_000_000)
    negada: bool = False
    motivo: str | None = Field(None, max_length=200)
    nome: str | None = Field(None, max_length=150)


@pub.post("/{token}/localizacao", dependencies=[Depends(limite_pub)])
def localizacao(token: str, body: LocalizacaoIn, request: Request, db: Session = Depends(get_db)):
    link = _link(db, token)
    ok = not body.negada and body.latitude is not None and body.longitude is not None
    _registrar(db, link, request, "localizacao" if ok else "localizacao_negada", latitude=body.latitude if ok else None,
               longitude=body.longitude if ok else None, precisao=body.precisao if ok else None, nome=body.nome,
               detalhes={"motivo": body.motivo} if not ok and body.motivo else None)
    db.commit()
    if not ok and link.exige_localizacao:
        raise HTTPException(403, "Este link exige que você permita a localização do aparelho")
    return {"sessao": _sessao(link, ok)}


def _fotos(db: Session, link: LinkPublico) -> list[Arquivo]:
    return list(db.scalars(select(Arquivo).where(Arquivo.entidade == link.entidade, Arquivo.entidade_id == link.entidade_id,
                                                 Arquivo.mime.like("image/%"))
                           .order_by(Arquivo.capturado_em.asc().nulls_last(), Arquivo.id)))


@pub.get("/{token}/conteudo", dependencies=[Depends(limite_pub)])
def conteudo(token: str, request: Request, x_link_sessao: str | None = Header(None), db: Session = Depends(get_db)):
    link = _link(db, token)
    _validar_sessao(link, x_link_sessao)
    _registrar(db, link, request, "visualizou")
    db.commit()
    fotos = [{"id": a.id, "descricao": a.descricao, "largura": a.largura, "altura": a.altura,
              "capturado_em": a.capturado_em, "latitude": a.latitude, "longitude": a.longitude}
             for a in _fotos(db, link)]
    if link.tipo == "fotos":
        enviadas = db.scalar(select(func.count()).where(Arquivo.link_id == link.id))
        return {"tipo": "fotos", "enviadas": enviadas, "max_fotos": link.max_fotos}
    if link.entidade == "diario":
        from app.modules.diario.models import DiarioObra
        from app.modules.diario.schemas import DiarioOut

        d = db.get(DiarioObra, link.entidade_id)
        dados = DiarioOut.model_validate(d).model_dump(mode="json")
        for campo in ("created_at", "updated_at", "obra_id"):
            dados.pop(campo, None)
        return {"tipo": "diario", "diario": dados, "fotos": fotos}
    return {"tipo": "obra", "fotos": fotos}


@pub.get("/{token}/foto/{arquivo_id}", dependencies=[Depends(limite_pub)])
def foto(token: str, arquivo_id: int, s: str = Query(...), db: Session = Depends(get_db)):
    link = _link(db, token)
    _validar_sessao(link, s)
    a = db.get(Arquivo, arquivo_id)
    if not a or a.entidade != link.entidade or a.entidade_id != link.entidade_id or not a.mime.startswith("image/"):
        raise HTTPException(404, "Foto não encontrada")
    return Response(imagens.derivado(a.uuid, 1600), media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff"})


@pub.get("/{token}/pdf", dependencies=[Depends(limite_pub)])
def pdf(token: str, request: Request, s: str = Query(...), db: Session = Depends(get_db)):
    link = _link(db, token)
    _validar_sessao(link, s)
    if link.tipo != "visualizar" or link.entidade != "diario":
        raise HTTPException(404, "PDF indisponível para este link")
    from app.modules.diario.models import DiarioObra
    from app.modules.diario.relatorio import pdf_diario

    d = db.get(DiarioObra, link.entidade_id)
    dados = pdf_diario(db, d)
    _registrar(db, link, request, "baixou_pdf")
    db.commit()
    return Response(dados, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="diario-{d.data.isoformat()}.pdf"'})


@pub.post("/{token}/fotos", status_code=201, dependencies=[Depends(limite_envio)])
async def enviar_foto(token: str, request: Request, arquivo: UploadFile = File(...), sessao: str = Form(...),
                      nome: str | None = Form(None, max_length=150), descricao: str | None = Form(None, max_length=255),
                      latitude: float | None = Form(None, ge=-90, le=90), longitude: float | None = Form(None, ge=-180, le=180),
                      precisao: float | None = Form(None, ge=0), db: Session = Depends(get_db)):
    from app.modules.sistema.arquivos import salvar_arquivo

    link = _link(db, token)
    _validar_sessao(link, sessao)
    if link.tipo != "fotos":
        raise HTTPException(403, "Este link não permite envio de fotos")
    if link.max_fotos and db.scalar(select(func.count()).where(Arquivo.link_id == link.id)) >= link.max_fotos:
        raise HTTPException(409, "Limite de fotos deste link atingido")
    dados = await storage.read_upload(arquivo)
    if (storage.detect_mime(dados[:4096], arquivo.filename or "") or "") not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Envie apenas fotos (JPG, PNG ou WEBP)")
    a = salvar_arquivo(db, dados, arquivo.filename or "foto.jpg", link.entidade, link.entidade_id, descricao=descricao,
                       latitude=latitude, longitude=longitude, origem="link", remetente=nome, link_id=link.id)
    _registrar(db, link, request, "enviou_foto", latitude=latitude, longitude=longitude, precisao=precisao, nome=nome,
               detalhes={"arquivo_id": a.id, "coord_foto": [a.latitude, a.longitude], "fonte": a.coord_fonte})
    db.commit()
    return {"id": a.id, "capturado_em": a.capturado_em, "coord_fonte": a.coord_fonte}


def _404():
    raise HTTPException(404, "Link não encontrado")


module = ModuleDef(key="links", label="Links públicos", icon="link", order=905, core=True, routers=[admin, pub])
