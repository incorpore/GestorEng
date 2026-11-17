from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.database import SessionLocal, get_db
from app.core.deps import CurrentUser, require_superuser
from app.core.registry import ModuleDef
from app.modules.sistema.service import set_integracao

from . import service
from .models import BackupLog

r = APIRouter(prefix="/backup", tags=["backup"])


class BackupCfgIn(BaseModel):
    ativo: bool = False
    endpoint_url: str = Field("", max_length=300)
    regiao: str = Field("us-east-1", max_length=40)
    bucket: str = Field("", max_length=100)
    prefixo: str = Field("struvia/", max_length=200)
    access_key: str = Field("", max_length=200)
    hora: int = Field(2, ge=0, le=23)
    minuto: int = Field(30, ge=0, le=59)
    retencao_dias: int = Field(30, ge=0, le=3650)
    incluir_arquivos: bool = True
    path_style: bool = True
    sse: bool = False
    secret_key: str | None = Field(None, max_length=300)


@r.get("/config")
def obter(db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    cfg, secret = service.config(db)
    return {**cfg, "secret_definido": bool(secret)}


@r.put("/config")
def salvar(body: BackupCfgIn, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    data = body.model_dump(exclude={"secret_key"})
    if data["endpoint_url"] and not data["endpoint_url"].startswith(("https://", "http://")):
        raise HTTPException(422, "Endpoint deve começar com http:// ou https://")
    if data["prefixo"] and not data["prefixo"].endswith("/"):
        data["prefixo"] += "/"
    set_integracao(db, service.CHAVE, data, body.secret_key)
    audit.log(db, user_id=cu.id, action="configurar_backup", entity="backup", data=data, request=request)
    db.commit()
    return obter(db, cu)


@r.post("/testar")
def testar(db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    return service.testar(db)


def _run_bg(origem: str):
    with SessionLocal() as db:
        service.executar(db, origem)


@r.post("/executar", status_code=202)
def executar(bg: BackgroundTasks, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    if db.scalar(select(BackupLog).where(BackupLog.status == "executando")):
        raise HTTPException(409, "Já existe um backup em execução")
    service.config(db)
    audit.log(db, user_id=cu.id, action="backup_manual", entity="backup", request=request)
    db.commit()
    bg.add_task(_run_bg, "manual")
    return {"iniciado_em": datetime.now(UTC)}


@r.get("/historico")
def historico(db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    rows = db.scalars(select(BackupLog).order_by(BackupLog.id.desc()).limit(50)).all()
    return [{"id": b.id, "iniciado_em": b.iniciado_em, "concluido_em": b.concluido_em, "status": b.status, "origem": b.origem,
             "chave": b.chave, "tamanho": b.tamanho, "mensagem": b.mensagem} for b in rows]


@r.get("/remotos")
def remotos(db: Session = Depends(get_db), cu: CurrentUser = Depends(require_superuser)):
    return service.listar_remotos(db)


module = ModuleDef(key="backup", label="Backup", icon="database", order=960, core=True, routers=[r])
