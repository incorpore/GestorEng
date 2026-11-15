"""Criptografia simétrica para segredos armazenados no banco (chaves de API etc.)."""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings


def _fernet() -> Fernet:
    key = hashlib.sha256(get_settings().encryption_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None
