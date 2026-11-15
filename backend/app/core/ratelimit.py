"""Limitador simples por IP (janela deslizante em memória) para endpoints sensíveis."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from .audit import client_ip


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = Lock()

    def __call__(self, request: Request) -> None:
        key = f"{request.url.path}:{client_ip(request)}"
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos.")
            q.append(now)


login_limiter = RateLimiter(limit=10, window_seconds=300)
sensitive_limiter = RateLimiter(limit=30, window_seconds=60)
