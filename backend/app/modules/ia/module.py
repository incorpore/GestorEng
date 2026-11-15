"""Assistente de IA via OpenRouter (redação de documentos, resumos de editais, análise de diários)."""
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import audit
from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.ratelimit import RateLimiter
from app.core.registry import ModuleDef, Permission, registry
from app.modules.sistema.service import get_integracao

r = APIRouter(prefix="/ia", tags=["ia"])
limiter = RateLimiter(limit=20, window_seconds=60)

SYSTEM = (
    "Você é o assistente da construtora {empresa}, especializado em engenharia civil, obras públicas e privadas, "
    "licitações (Lei 14.133/2021), gestão de contratos, medições e documentação técnica no Brasil. "
    "Responda sempre em português do Brasil, de forma objetiva, técnica e formal."
)


class Msg(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=50_000)


class ChatIn(BaseModel):
    mensagens: list[Msg] = Field(min_length=1, max_length=40)
    modelo: str | None = Field(None, max_length=120)
    entidade: str | None = None
    entidade_id: int | None = None


class RedigirIn(BaseModel):
    instrucao: str = Field(min_length=3, max_length=5000)
    tipo: str | None = Field(None, max_length=40)
    conteudo_atual: str | None = Field(None, max_length=200_000)
    entidade: str | None = None
    entidade_id: int | None = None


def _client(db: Session):
    cfg, key = get_integracao(db, "openrouter")
    if not key:
        raise HTTPException(400, "Integração com OpenRouter não configurada (Configurações > Integrações)")
    base = (cfg.get("base_url") or "https://openrouter.ai/api/v1").rstrip("/")
    return base, key, cfg.get("modelo") or "anthropic/claude-sonnet-4.5"


def _call(db: Session, messages: list[dict], modelo: str | None = None, max_tokens: int = 4000) -> str:
    base, key, default = _client(db)
    try:
        with httpx.Client(timeout=120) as c:
            resp = c.post(f"{base}/chat/completions", headers={
                "Authorization": f"Bearer {key}", "X-Title": "GestorEng", "Content-Type": "application/json",
            }, json={"model": modelo or default, "messages": messages, "max_tokens": max_tokens})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Falha ao contatar OpenRouter: {e.__class__.__name__}")
    if resp.status_code >= 400:
        raise HTTPException(502, f"OpenRouter retornou {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError):
        raise HTTPException(502, "Resposta inesperada do OpenRouter")


def _contexto(db: Session, cu: CurrentUser, entidade: str | None, entidade_id: int | None) -> str:
    if not entidade or not entidade_id:
        return ""
    info = registry.template_entities.get(entidade)
    if not info or not cu.has(info[2]):
        raise HTTPException(403, "Sem permissão para usar estes dados como contexto")
    from app.modules.documentos.render import obj_to_ctx

    obj = db.get(info[1], entidade_id)
    if not obj:
        return ""
    import json

    return f"\n\nDados do registro ({info[0]}) em JSON:\n" + json.dumps(obj_to_ctx(obj), default=str, ensure_ascii=False)[:30000]


def _empresa(db):
    from app.modules.sistema.service import get_config

    e = get_config(db, "empresa")
    return e.get("nome_fantasia") or e.get("razao_social") or "a empresa"


@r.post("/chat", dependencies=[Depends(limiter)])
def chat(body: ChatIn, request: Request, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("ia.usar"))):
    sys = SYSTEM.format(empresa=_empresa(db)) + _contexto(db, cu, body.entidade, body.entidade_id)
    msgs = [{"role": "system", "content": sys}] + [m.model_dump() for m in body.mensagens]
    out = _call(db, msgs, body.modelo)
    audit.log(db, user_id=cu.id, action="ia_chat", entity="ia", data={"modelo": body.modelo}, request=request)
    db.commit()
    return {"resposta": out}


@r.post("/redigir", dependencies=[Depends(limiter)])
def redigir(body: RedigirIn, request: Request, db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require("ia.usar"))):
    sys = SYSTEM.format(empresa=_empresa(db)) + (
        "\n\nVocê redige documentos oficiais (ofícios, declarações, recibos, relatórios, notificações). "
        "Retorne SOMENTE o corpo do documento em HTML simples (p, h2, h3, strong, em, ul, ol, li, table, tr, th, td, br), "
        "sem <html>, <head>, <body>, sem markdown e sem cercas de código. Você pode usar variáveis do sistema no formato "
        "{{ empresa.razao_social }}, {{ hoje|data_extenso }}, {{ cidade_emissao }}, {{ documento.numero }}, "
        "{{ documento.destinatario }}, {{ usuario.nome }}, {{ obra.nome }}, {{ valor|moeda }} quando fizer sentido."
    ) + _contexto(db, cu, body.entidade, body.entidade_id)
    user = f"Tipo de documento: {body.tipo or 'não informado'}\nInstrução: {body.instrucao}"
    if body.conteudo_atual:
        user += f"\n\nConteúdo atual (revise/complete):\n{body.conteudo_atual}"
    html = _call(db, [{"role": "system", "content": sys}, {"role": "user", "content": user}])
    html = html.strip().removeprefix("```html").removeprefix("```").removesuffix("```").strip()
    audit.log(db, user_id=cu.id, action="ia_redigir", entity="ia", request=request)
    db.commit()
    return {"html": html}


@r.get("/modelos")
def modelos(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("ia.usar"))):
    base, key, default = _client(db)
    try:
        with httpx.Client(timeout=30) as c:
            resp = c.get(f"{base}/models", headers={"Authorization": f"Bearer {key}"})
        items = resp.json().get("data", []) if resp.status_code < 400 else []
    except (httpx.HTTPError, ValueError):
        items = []
    return {"padrao": default, "modelos": [{"id": m.get("id"), "nome": m.get("name")} for m in items]}


@r.post("/testar")
def testar(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("configuracoes.editar"))):
    out = _call(db, [{"role": "user", "content": "Responda apenas: OK"}], max_tokens=10)
    return {"ok": True, "resposta": out}


module = ModuleDef(key="ia", label="Assistente IA", icon="sparkles", order=70, routers=[r],
                   permissions=[Permission("ia.usar", "Assistente IA: Utilizar", "ia")])
