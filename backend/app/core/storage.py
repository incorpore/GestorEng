"""Armazenamento seguro de arquivos em disco (fora da raiz web)."""
import hashlib
import os
import re
import uuid
from pathlib import Path

import filetype
from fastapi import HTTPException, UploadFile

from .config import get_settings

ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword", "application/vnd.ms-excel", "application/zip",
    "text/plain", "text/csv", "application/xml",
}
TEXT_EXT = {".txt": "text/plain", ".csv": "text/csv", ".xml": "application/xml", ".dwg": "application/acad"}


def root() -> Path:
    p = Path(get_settings().storage_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def path_for(file_uuid: str) -> Path:
    if not re.fullmatch(r"[0-9a-f\-]{36}", file_uuid):
        raise HTTPException(400, "Identificador inválido")
    return root() / file_uuid[:2] / file_uuid


def safe_name(name: str) -> str:
    name = os.path.basename(name or "arquivo")
    name = re.sub(r"[^\w.\- ()À-ÿ]", "_", name)
    return name[:200] or "arquivo"


def detect_mime(head: bytes, filename: str) -> str | None:
    kind = filetype.guess(head)
    if kind:
        return kind.mime
    ext = Path(filename).suffix.lower()
    if ext in TEXT_EXT:
        try:
            head.decode("utf-8")
        except UnicodeDecodeError:
            if ext != ".dwg":
                return None
        return TEXT_EXT[ext]
    return None


async def save_upload(upload: UploadFile, allowed: set[str] | None = None) -> dict:
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"Arquivo excede {get_settings().max_upload_mb} MB")
    if not data:
        raise HTTPException(400, "Arquivo vazio")
    return save_bytes(data, upload.filename or "arquivo", allowed)


def save_bytes(data: bytes, filename: str, allowed: set[str] | None = None, mime: str | None = None) -> dict:
    mime = mime or detect_mime(data[:4096], filename)
    allowed = allowed or ALLOWED_MIME | {"application/acad"}
    if mime is None or mime not in allowed:
        raise HTTPException(415, "Tipo de arquivo não permitido")
    file_uuid = str(uuid.uuid4())
    dest = path_for(file_uuid)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {
        "uuid": file_uuid,
        "nome": safe_name(filename),
        "mime": mime,
        "tamanho": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def read_bytes(file_uuid: str) -> bytes:
    p = path_for(file_uuid)
    if not p.exists():
        raise HTTPException(404, "Arquivo não encontrado")
    return p.read_bytes()


def delete(file_uuid: str) -> None:
    p = path_for(file_uuid)
    if p.exists():
        p.unlink()
