"""Anexos genéricos: qualquer entidade registrada como 'attachable' pode receber arquivos."""
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.models import Arquivo
from app.core.registry import registry
from app.core.scope import allowed_obra_ids
from app.core.security import ALGORITHM, decode_token

router = APIRouter(prefix="/arquivos", tags=["arquivos"])

# Entidades especiais (não ligadas a módulo): entidade -> permissão para ver / editar
SPECIAL = {"timbrado": (None, "configuracoes.editar"), "logo": (None, "configuracoes.editar"),
           "documento": ("documentos.ver", "documentos.editar")}
# Entidades com escopo de obra: entidade -> (tabela, coluna da obra)
OBRA_SCOPED = {"obra": ("obras", "id"), "medicao": ("medicoes", "obra_id"), "diario": ("diarios_obra", "obra_id")}


class ArquivoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    nome: str
    mime: str
    tamanho: int
    entidade: str | None
    entidade_id: int | None
    descricao: str | None
    created_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    coord_fonte: str | None = None
    capturado_em: datetime | None = None
    largura: int | None = None
    altura: int | None = None
    origem: str | None = None
    enviado_por_nome: str | None = None
    tem_original: bool = False


# Entidades cujas fotos recebem marca d'água (coordenadas + data/hora)
FOTO_ENTIDADES = {"obra", "diario", "medicao"}


def obra_da_entidade(db: Session, entidade: str | None, entidade_id: int | None) -> int | None:
    if not entidade or not entidade_id or entidade not in OBRA_SCOPED:
        return None
    from sqlalchemy import text

    table, col = OBRA_SCOPED[entidade]
    return db.execute(text(f"SELECT {col} FROM {table} WHERE id = :i"), {"i": entidade_id}).scalar()  # noqa: S608


def coordenadas_obra(db: Session, obra_id: int | None) -> tuple[float, float] | None:
    from app.modules.obras.models import Obra

    obra = db.get(Obra, obra_id) if obra_id else None
    try:
        return (float(obra.latitude), float(obra.longitude)) if obra and obra.latitude and obra.longitude else None
    except ValueError:
        return None


def salvar_arquivo(db: Session, dados: bytes, nome: str, entidade: str, entidade_id: int, *, descricao: str | None = None,
                   latitude: float | None = None, longitude: float | None = None, quando: datetime | None = None,
                   user_id: int | None = None, origem: str = "sistema", remetente: str | None = None,
                   link_id: int | None = None) -> Arquivo:
    """Grava o arquivo. Fotos de obra/diário/medição são processadas (orientação + marca d'água) e o original é mantido."""
    from pathlib import Path

    from app.core import imagens

    mime = storage.detect_mime(dados[:4096], nome)
    extra: dict = {}
    if mime in {"image/jpeg", "image/png", "image/webp"} and entidade in FOTO_ENTIDADES:
        original = storage.save_bytes(dados, nome)
        try:
            fp = imagens.processar_foto(dados, latitude=latitude, longitude=longitude, quando=quando,
                                        coords_obra=coordenadas_obra(db, obra_da_entidade(db, entidade, entidade_id)))
        except Exception:  # noqa: BLE001
            storage.delete(original["uuid"])
            raise HTTPException(415, "Imagem inválida ou corrompida")
        meta = storage.save_bytes(fp.jpeg, f"{Path(nome).stem}.jpg", mime="image/jpeg")
        extra = {"latitude": fp.latitude, "longitude": fp.longitude, "coord_fonte": fp.coord_fonte,
                 "capturado_em": fp.capturado_em, "largura": fp.largura, "altura": fp.altura,
                 "original_uuid": original["uuid"]}
    else:
        meta = storage.save_bytes(dados, nome)
        if mime and mime.startswith("image/"):
            try:
                extra["largura"], extra["altura"] = imagens.dimensoes(dados)
            except Exception:  # noqa: BLE001,S110
                pass
    a = Arquivo(**meta, **extra, entidade=entidade, entidade_id=entidade_id, descricao=(descricao or "")[:255] or None,
                enviado_por_id=user_id, origem=origem, enviado_por_nome=remetente, link_id=link_id)
    db.add(a)
    db.flush()
    return a


def _perms(entidade: str) -> tuple[str | None, str]:
    if entidade in SPECIAL:
        return SPECIAL[entidade]
    prefix = registry.attachable.get(entidade)
    if not prefix:
        raise HTTPException(422, "Entidade não aceita anexos")
    return f"{prefix}.ver", f"{prefix}.editar"


def check_access(db: Session, cu: CurrentUser, entidade: str | None, entidade_id: int | None, write: bool) -> None:
    if entidade is None:
        if not cu.user.superusuario:
            raise HTTPException(403, "Sem acesso")
        return
    ver, editar = _perms(entidade)
    code = editar if write else ver
    if code and not cu.has(code):
        raise HTTPException(403, "Permissão insuficiente")
    if entidade in OBRA_SCOPED and entidade_id:
        ids = allowed_obra_ids(db, cu)
        if ids is not None:
            from sqlalchemy import text

            table, col = OBRA_SCOPED[entidade]
            obra_id = db.execute(text(f"SELECT {col} FROM {table} WHERE id = :i"), {"i": entidade_id}).scalar()  # noqa: S608
            if obra_id not in ids:
                raise HTTPException(403, "Sem acesso a esta obra")


def _out(a: Arquivo) -> ArquivoOut:
    o = ArquivoOut.model_validate(a)
    o.tem_original = bool(a.original_uuid)
    return o


@router.get("", response_model=list[ArquivoOut])
def listar(entidade: str, entidade_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    check_access(db, cu, entidade, entidade_id, write=False)
    rows = db.scalars(select(Arquivo).where(Arquivo.entidade == entidade, Arquivo.entidade_id == entidade_id)
                      .order_by(Arquivo.capturado_em.asc().nulls_last(), Arquivo.id.asc())).all()
    return [_out(a) for a in rows]


class LegendaIn(BaseModel):
    descricao: str | None = None


@router.patch("/{aid}", response_model=ArquivoOut)
def legenda(aid: int, body: LegendaIn, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    a = db.get(Arquivo, aid) or _404()
    check_access(db, cu, a.entidade, a.entidade_id, write=True)
    a.descricao = (body.descricao or "")[:255] or None
    db.commit()
    return _out(a)


@router.post("", response_model=ArquivoOut, status_code=201)
async def enviar(request: Request, arquivo: UploadFile = File(...), entidade: str = Form(...),
                 entidade_id: int = Form(...), descricao: str | None = Form(None),
                 latitude: float | None = Form(None, ge=-90, le=90), longitude: float | None = Form(None, ge=-180, le=180),
                 db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    check_access(db, cu, entidade, entidade_id, write=True)
    dados = await storage.read_upload(arquivo)
    a = salvar_arquivo(db, dados, arquivo.filename or "arquivo", entidade, entidade_id, descricao=descricao,
                       latitude=latitude, longitude=longitude, user_id=cu.id)
    audit.log(db, user_id=cu.id, action="anexar", entity=entidade, entity_id=entidade_id,
              data={"arquivo": a.nome, "id": a.id}, request=request)
    db.commit()
    return _out(a)


def _file_token(a: Arquivo, original: bool = False, tamanho: int | None = None) -> str:
    now = datetime.now(UTC)
    return jwt.encode({"typ": "file", "fid": a.id, "orig": original, "tam": tamanho, "iat": now,
                       "exp": now + timedelta(minutes=10)}, get_settings().secret_key, algorithm=ALGORITHM)


@router.get("/{aid}/link")
def link(aid: int, original: bool = False, miniatura: bool = False, db: Session = Depends(get_db),
         cu: CurrentUser = Depends(get_current_user)):
    """URL assinada e de curta duração (para <img>, visualização e download no app)."""
    a = db.get(Arquivo, aid) or _404()
    check_access(db, cu, a.entidade, a.entidade_id, write=original)
    if original and not a.original_uuid:
        raise HTTPException(404, "Este arquivo não possui original separado")
    tam = 480 if miniatura and a.mime.startswith("image/") else None
    return {"url": f"/api/arquivos/{a.id}/conteudo?t={_file_token(a, original, tam)}", "expira_em": 600}


@router.get("/{aid}/conteudo")
def conteudo(aid: int, t: str = Query(...), download: bool = False, db: Session = Depends(get_db)):
    data = decode_token(t, typ="file")
    if not data or data.get("fid") != aid:
        raise HTTPException(401, "Link expirado")
    a = db.get(Arquivo, aid) or _404()
    disp = "attachment" if download or not a.mime.startswith(("image/", "application/pdf")) else "inline"
    from urllib.parse import quote

    from app.core import imagens

    if data.get("orig") and a.original_uuid:
        corpo = storage.read_bytes(a.original_uuid)
        mime = storage.detect_mime(corpo[:4096], a.nome) or a.mime
    elif data.get("tam"):
        corpo, mime = imagens.derivado(a.uuid, int(data["tam"])), "image/jpeg"
    else:
        corpo, mime = storage.read_bytes(a.uuid), a.mime
    return Response(corpo, media_type=mime, headers={
        "Content-Disposition": f"{disp}; filename*=UTF-8''{quote(a.nome)}",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=600",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    })


@router.delete("/{aid}", status_code=204)
def excluir(aid: int, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    a = db.get(Arquivo, aid) or _404()
    check_access(db, cu, a.entidade, a.entidade_id, write=True)
    uuid, original = a.uuid, a.original_uuid
    db.delete(a)
    audit.log(db, user_id=cu.id, action="remover_anexo", entity=a.entidade or "arquivo", entity_id=a.entidade_id,
              data={"arquivo": a.nome}, request=request)
    db.commit()
    storage.delete(uuid)
    if original:
        storage.delete(original)


def _404():
    raise HTTPException(404, "Arquivo não encontrado")
