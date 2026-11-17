import time
from copy import deepcopy

from sqlalchemy.orm import Session

from app.core.crypto import decrypt, encrypt

from .models import Configuracao, Integracao

DEFAULTS: dict[str, dict] = {
    "empresa": {
        "razao_social": "Velmont", "nome_fantasia": "Velmont", "cnpj": "", "inscricao_estadual": "",
        "inscricao_municipal": "", "endereco": "", "bairro": "", "cidade": "", "uf": "", "cep": "", "telefone": "",
        "email": "", "site": "", "responsavel": "", "cargo_responsavel": "", "email_responsavel": "", "cpf_responsavel": "", "crea": "", "cor_primaria": "#1d4ed8",
        "logo_arquivo_id": None,
    },
    "timbrado": {
        "ativo": True, "arquivo_id": None, "arquivo_continuacao_id": None,
        "margem_superior": 40, "margem_inferior": 30, "margem_esquerda": 25, "margem_direita": 20,
        "fonte": "Arial, Helvetica, sans-serif", "tamanho_fonte": 11, "entrelinha": 1.4,
        "numerar_paginas": True, "texto_numeracao": "Página {pagina} de {total}",
    },
    "documentos": {"cidade_emissao": "", "reiniciar_numeracao_anual": True},
    "modulos": {"desativados": []},
}


def get_config(db: Session, chave: str) -> dict:
    row = db.get(Configuracao, chave)
    base = deepcopy(DEFAULTS.get(chave, {}))
    if row and isinstance(row.valor, dict):
        base.update(row.valor)
    return base


def set_config(db: Session, chave: str, valor: dict) -> dict:
    row = db.get(Configuracao, chave)
    allowed = DEFAULTS.get(chave)
    clean = {k: v for k, v in valor.items() if allowed is None or k in allowed}
    if row is None:
        row = Configuracao(chave=chave, valor=clean)
        db.add(row)
    else:
        row.valor = {**(row.valor or {}), **clean}
    _cache.clear()
    return get_config(db, chave) if row else clean


def get_integracao(db: Session, chave: str) -> tuple[dict, str | None]:
    row = db.get(Integracao, chave)
    if not row:
        return {}, None
    return dict(row.config or {}), decrypt(row.segredo_cifrado) if row.segredo_cifrado else None


def set_integracao(db: Session, chave: str, config: dict, segredo: str | None, limpar_segredo: bool = False) -> None:
    row = db.get(Integracao, chave)
    if row is None:
        row = Integracao(chave=chave, config={})
        db.add(row)
    row.config = config
    if segredo:
        row.segredo_cifrado = encrypt(segredo)
    elif limpar_segredo:
        row.segredo_cifrado = None


_cache: dict[str, tuple[float, set[str]]] = {}


def disabled_modules(db: Session) -> set[str]:
    hit = _cache.get("mods")
    if hit and time.monotonic() - hit[0] < 10:
        return hit[1]
    val = set(get_config(db, "modulos").get("desativados") or [])
    _cache["mods"] = (time.monotonic(), val)
    return val
