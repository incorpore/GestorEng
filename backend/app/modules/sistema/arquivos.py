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


@router.get("", response_model=list[ArquivoOut])
def listar(entidade: str, entidade_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    check_access(db, cu, entidade, entidade_id, write=False)
    return db.scalars(select(Arquivo).where(Arquivo.entidade == entidade, Arquivo.entidade_id == entidade_id)
                      .order_by(Arquivo.id.desc())).all()


@router.post("", response_model=ArquivoOut, status_code=201)
async def enviar(request: Request, arquivo: UploadFile = File(...), entidade: str = Form(...),
                 entidade_id: int = Form(...), descricao: str | None = Form(None),
                 db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    check_access(db, cu, entidade, entidade_id, write=True)
    meta = await storage.save_upload(arquivo)
    a = Arquivo(**meta, entidade=entidade, entidade_id=entidade_id, descricao=(descricao or "")[:255] or None,
                enviado_por_id=cu.id)
    db.add(a)
    db.flush()
    audit.log(db, user_id=cu.id, action="anexar", entity=entidade, entity_id=entidade_id,
              data={"arquivo": a.nome, "id": a.id}, request=request)
    db.commit()
    return a


def _file_token(a: Arquivo) -> str:
    now = datetime.now(UTC)
    return jwt.encode({"typ": "file", "fid": a.id, "iat": now, "exp": now + timedelta(minutes=10)},
                      get_settings().secret_key, algorithm=ALGORITHM)


@router.get("/{aid}/link")
def link(aid: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    """URL assinada e de curta duração (para <img>, visualização e download no app)."""
    a = db.get(Arquivo, aid) or _404()
    check_access(db, cu, a.entidade, a.entidade_id, write=False)
    return {"url": f"/api/arquivos/{a.id}/conteudo?t={_file_token(a)}", "expira_em": 600}


@router.get("/{aid}/conteudo")
def conteudo(aid: int, t: str = Query(...), download: bool = False, db: Session = Depends(get_db)):
    data = decode_token(t, typ="file")
    if not data or data.get("fid") != aid:
        raise HTTPException(401, "Link expirado")
    a = db.get(Arquivo, aid) or _404()
    disp = "attachment" if download or not a.mime.startswith(("image/", "application/pdf")) else "inline"
    from urllib.parse import quote

    return Response(storage.read_bytes(a.uuid), media_type=a.mime, headers={
        "Content-Disposition": f"{disp}; filename*=UTF-8''{quote(a.nome)}",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=600",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    })


@router.delete("/{aid}", status_code=204)
def excluir(aid: int, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    a = db.get(Arquivo, aid) or _404()
    check_access(db, cu, a.entidade, a.entidade_id, write=True)
    uuid = a.uuid
    db.delete(a)
    audit.log(db, user_id=cu.id, action="remover_anexo", entity=a.entidade or "arquivo", entity_id=a.entidade_id,
              data={"arquivo": a.nome}, request=request)
    db.commit()
    storage.delete(uuid)


def _404():
    raise HTTPException(404, "Arquivo não encontrado")
