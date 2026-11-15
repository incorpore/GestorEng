"""Limitador de requisições por IP para endpoints sensíveis.

Usa Redis (REDIS_URL) quando disponível — compartilhado entre workers/réplicas —
e cai para janela deslizante em memória caso contrário.
"""
import logging
import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from .audit import client_ip

log = logging.getLogger(__name__)
_redis = None
if os.getenv("REDIS_URL"):
    try:
        import redis

        _redis = redis.Redis.from_url(os.environ["REDIS_URL"], socket_timeout=1, socket_connect_timeout=1)
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
            k = f"rl:{key}:{int(time.time() // self.window)}"
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
