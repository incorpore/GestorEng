import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.modules import load_modules

log = logging.getLogger("struvia")
settings = get_settings()

app = FastAPI(
    title="Struvia API",
    version="1.0.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Client"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    h = response.headers
    h.setdefault("X-Content-Type-Options", "nosniff")
    h.setdefault("X-Frame-Options", "DENY")
    h.setdefault("Referrer-Policy", "no-referrer")
    h.setdefault("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()")
    if request.url.path.startswith("/api/") and "Cache-Control" not in h:
        h["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    erros = [{"campo": ".".join(str(p) for p in e["loc"][1:]), "mensagem": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "Dados inválidos", "erros": erros})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Erro não tratado em %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor"})


def module_guard(key: str):
    def dep(db: Session = Depends(get_db)):
        from app.modules.sistema.service import disabled_modules

        if key in disabled_modules(db):
            raise HTTPException(404, "Módulo desativado")

    return dep


for mod in load_modules():
    for router in mod.routers:
        deps = [] if mod.core else [Depends(module_guard(mod.key))]
        app.include_router(router, prefix="/api", dependencies=deps)


@app.get("/api/health", tags=["sistema"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
