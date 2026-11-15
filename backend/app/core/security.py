import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import get_settings

_ph = PasswordHasher()
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    return _ph.check_needs_rehash(hashed)


# Hash fixo para mitigar enumeração de usuários por tempo de resposta
DUMMY_HASH = _ph.hash(secrets.token_urlsafe(16))


def validate_password_strength(password: str) -> str | None:
    if len(password) < 10:
        return "A senha deve ter pelo menos 10 caracteres"
    classes = sum(
        [
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        ]
    )
    if classes < 3:
        return "A senha deve combinar ao menos 3 entre: minúsculas, maiúsculas, números e símbolos"
    return None


def create_access_token(user_id: int, token_version: int, extra: dict | None = None) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
        "typ": "access",
        **(extra or {}),
    }
    return jwt.encode(payload, s.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, typ: str = "access") -> dict | None:
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if data.get("typ") != typ:
        return None
    return data


def new_opaque_token() -> tuple[str, str]:
    """Retorna (token em claro, hash sha256) — apenas o hash é armazenado."""
    token = secrets.token_urlsafe(48)
    return token, sha256(token)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
