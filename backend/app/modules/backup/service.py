"""Backup completo (banco + arquivos) para armazenamento compatível com S3 (AWS, MinIO, Backblaze B2,
Cloudflare R2, Wasabi, ZimaOS/MinIO...).

Formato: struvia-AAAAMMDD-HHMMSS.tar.gz contendo `database.dump` (pg_dump -Fc) e `storage/`.
"""
import hashlib
import logging
import os
import shutil
import subprocess  # noqa: S404
import tarfile
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.sistema.service import get_integracao

from .models import BackupLog

log = logging.getLogger("backup")
CHAVE = "backup_s3"
DEFAULTS = {"ativo": False, "endpoint_url": "", "regiao": "us-east-1", "bucket": "", "prefixo": "struvia/", "access_key": "",
            "hora": 2, "minuto": 30, "retencao_dias": 30, "incluir_arquivos": True, "path_style": True, "sse": False}


def config(db: Session) -> tuple[dict, str | None]:
    cfg, secret = get_integracao(db, CHAVE)
    return {**DEFAULTS, **cfg}, secret


def _client(cfg: dict, secret: str | None):
    import boto3
    from botocore.config import Config

    if not cfg.get("bucket") or not cfg.get("access_key") or not secret:
        raise HTTPException(400, "Backup S3 não configurado (bucket, access key e secret)")
    return boto3.client(
        "s3", endpoint_url=cfg.get("endpoint_url") or None, region_name=cfg.get("regiao") or "us-east-1",
        aws_access_key_id=cfg["access_key"], aws_secret_access_key=secret,
        config=Config(s3={"addressing_style": "path" if cfg.get("path_style") else "auto"}, retries={"max_attempts": 5},
                      signature_version="s3v4"),
    )


def _pg_env() -> tuple[list[str], dict]:
    u = urlparse(get_settings().database_url.replace("postgresql+psycopg", "postgresql"))
    env = {**os.environ, "PGPASSWORD": unquote(u.password or "")}
    args = ["-h", u.hostname or "localhost", "-p", str(u.port or 5432), "-U", unquote(u.username or "postgres"),
            "-d", unquote(u.path.lstrip("/"))]
    return args, env


def testar(db: Session) -> dict:
    cfg, secret = config(db)
    s3 = _client(cfg, secret)
    try:
        s3.head_bucket(Bucket=cfg["bucket"])
        key = f"{cfg['prefixo']}.teste-struvia"
        s3.put_object(Bucket=cfg["bucket"], Key=key, Body=b"ok")
        s3.delete_object(Bucket=cfg["bucket"], Key=key)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Falha ao acessar o bucket: {e.__class__.__name__}: {str(e)[:200]}")
    return {"ok": True}


def executar(db: Session, origem: str = "manual") -> BackupLog:
    cfg, secret = config(db)
    s3 = _client(cfg, secret)
    reg = BackupLog(origem=origem)
    db.add(reg)
    db.commit()
    tmp = Path(tempfile.mkdtemp(prefix="struvia-bkp-"))
    try:
        dump = tmp / "database.dump"
        args, env = _pg_env()
        r = subprocess.run(["pg_dump", "-Fc", "--no-owner", "--no-privileges", "-f", str(dump), *args],  # noqa: S603,S607
                           env=env, capture_output=True, text=True, timeout=3600)
        if r.returncode != 0:
            raise RuntimeError(f"pg_dump falhou: {r.stderr[-500:]}")
        nome = f"struvia-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.tar.gz"
        arq = tmp / nome
        with tarfile.open(arq, "w:gz") as tar:
            tar.add(dump, arcname="database.dump")
            storage = Path(get_settings().storage_dir)
            if cfg.get("incluir_arquivos") and storage.exists():
                tar.add(storage, arcname="storage")
        h = hashlib.sha256()
        with open(arq, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        key = f"{cfg['prefixo']}{nome}"
        extra = {"Metadata": {"sha256": h.hexdigest()}}
        if cfg.get("sse"):
            extra["ServerSideEncryption"] = "AES256"
        s3.upload_file(str(arq), cfg["bucket"], key, ExtraArgs=extra)
        reg.status, reg.chave, reg.tamanho, reg.sha256 = "sucesso", key, arq.stat().st_size, h.hexdigest()
        reg.mensagem = _limpar_antigos(s3, cfg)
    except Exception as e:  # noqa: BLE001
        log.exception("Backup falhou")
        reg.status, reg.mensagem = "erro", str(e)[:2000]
    finally:
        reg.concluido_em = datetime.now(UTC)
        db.commit()
        shutil.rmtree(tmp, ignore_errors=True)
    return reg


def _limpar_antigos(s3, cfg: dict) -> str | None:
    dias = int(cfg.get("retencao_dias") or 0)
    if dias <= 0:
        return None
    limite = datetime.now(UTC) - timedelta(days=dias)
    removidos = 0
    pag = s3.get_paginator("list_objects_v2")
    for page in pag.paginate(Bucket=cfg["bucket"], Prefix=cfg["prefixo"]):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".tar.gz") and obj["LastModified"] < limite:
                s3.delete_object(Bucket=cfg["bucket"], Key=obj["Key"])
                removidos += 1
    return f"{removidos} backup(s) antigo(s) removido(s)" if removidos else None


def listar_remotos(db: Session) -> list[dict]:
    cfg, secret = config(db)
    s3 = _client(cfg, secret)
    out = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=cfg["bucket"], Prefix=cfg["prefixo"]):
        for o in page.get("Contents", []):
            if o["Key"].endswith(".tar.gz"):
                out.append({"chave": o["Key"], "tamanho": o["Size"], "data": o["LastModified"]})
    return sorted(out, key=lambda x: x["data"], reverse=True)


def restaurar(db: Session, chave: str) -> None:
    """Restaura banco e arquivos a partir de um backup (uso via CLI, com o sistema parado)."""
    cfg, secret = config(db)
    s3 = _client(cfg, secret)
    tmp = Path(tempfile.mkdtemp(prefix="struvia-restore-"))
    try:
        arq = tmp / "backup.tar.gz"
        s3.download_file(cfg["bucket"], chave, str(arq))
        with tarfile.open(arq, "r:gz") as tar:
            tar.extractall(tmp, filter="data")
        args, env = _pg_env()
        db.close()
        r = subprocess.run(["pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges", *args,  # noqa: S603,S607
                            str(tmp / "database.dump")], env=env, capture_output=True, text=True, timeout=7200)
        if r.returncode not in (0, 1):
            raise RuntimeError(f"pg_restore falhou: {r.stderr[-800:]}")
        src = tmp / "storage"
        if src.exists():
            shutil.copytree(src, get_settings().storage_dir, dirs_exist_ok=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
