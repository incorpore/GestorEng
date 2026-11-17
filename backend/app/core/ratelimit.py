"""Limitador de requisições por IP para endpoints sensíveis.

Usa Redis (REDIS_URL) quando disponível — compartilhado entre workers/réplicas —
e cai para janela deslizante em memória caso contrário.
"""
import logging
import time
from collections import defaultdict, deque
from threading import Lock
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException, Request

from .audit import client_ip
from .config import get_settings

log = logging.getLogger(__name__)


def parse_redis_url(url: str, env_prefix: str | None = None) -> tuple[str, str]:
    """Separa o parâmetro `prefix` (não suportado pelo Redis) da URL.

    Ex.: redis://:senha@redis:6379/0?prefix=velmont  ->  ("redis://:senha@redis:6379/0", "velmont:")
    Precedência: ?prefix= na URL > REDIS_PREFIX > "struvia:".
    """
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    prefix = next((v for k, v in query if k == "prefix"), None) or env_prefix or "struvia"
    clean = urlunsplit(parts._replace(query=urlencode([(k, v) for k, v in query if k != "prefix"])))
    # separador ":" só é acrescentado se o prefixo não terminar em ":", "_", "-" ou "."
    return clean, prefix if prefix[-1] in ":_-." else f"{prefix}:"


_redis = None
PREFIX = "struvia:"
_cfg = get_settings()
if _cfg.redis_url:
    try:
        import redis

        _url, PREFIX = parse_redis_url(_cfg.redis_url, _cfg.redis_prefix)
        _redis = redis.Redis.from_url(_url, socket_timeout=1, socket_connect_timeout=1)
    except Exception:  # noqa: BLE001
        log.warning("Redis indisponível; usando limitador em memória")


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = Lock()

    def _redis_hit(self, key: str) -> bool | None:
        if _redis is None:
            return None
        try:
            k = f"{PREFIX}rl:{key}:{int(time.time() // self.window)}"
            pipe = _redis.pipeline()
            pipe.incr(k)
            pipe.expire(k, self.window + 5)
            n = pipe.execute()[0]
            return n <= self.limit
        except Exception:  # noqa: BLE001
            return None

    def __call__(self, request: Request) -> None:
        key = f"{request.url.path}:{client_ip(request)}"
        ok = self._redis_hit(key)
        if ok is None:
            now = time.monotonic()
            with self.lock:
                q = self.hits[key]
                while q and now - q[0] > self.window:
                    q.popleft()
                ok = len(q) < self.limit
                if ok:
                    q.append(now)
        if not ok:
            raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos.")


login_limiter = RateLimiter(limit=10, window_seconds=300)
sensitive_limiter = RateLimiter(limit=30, window_seconds=60)
