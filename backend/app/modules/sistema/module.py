import base64
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require
from app.core.models import Arquivo
from app.core.registry import ModuleDef, Permission, registry

from . import service
from .arquivos import router as arquivos_router
from .localidades import router as localidades_router

r = APIRouter(prefix="/configuracoes", tags=["configurações"])
pub = APIRouter(prefix="/publico", tags=["público"])
INTEGRACOES = {"openrouter": {"base_url": "https://openrouter.ai/api/v1", "modelo": "anthropic/claude-sonnet-4.5"},
               "documenso": {"base_url": "", "webhook_secret_definido": False},
               "openweather": {"base_url": "https://api.openweathermap.org"}}


@r.get("/{chave}")
def obter(chave: str, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    if chave not in service.DEFAULTS:
        raise HTTPException(404, "Configuração inexistente")
    if chave == "modulos" and not cu.has("configuracoes.ver"):
        raise HTTPException(403, "Permissão insuficiente")
    return service.get_config(db, chave)


@r.put("/{chave}")
def salvar(chave: str, valor: dict, request: Request, db: Session = Depends(get_db),
           cu: CurrentUser = Depends(require("configuracoes.editar"))):
    if chave not in service.DEFAULTS:
        raise HTTPException(404, "Configuração inexistente")
    if chave == "modulos":
        core = {m.key for m in registry.modules.values() if m.core}
        valor = {"desativados": [k for k in valor.get("desativados", []) if k in registry.modules and k not in core]}
    if chave == "timbrado":
        for k in ("margem_superior", "margem_inferior", "margem_esquerda", "margem_direita"):
            if k in valor and not (0 <= float(valor[k]) <= 120):
                raise HTTPException(422, "Margens devem estar entre 0 e 120 mm")
    out = service.set_config(db, chave, valor)
    audit.log(db, user_id=cu.id, action="configurar", entity="configuracao", entity_id=chave, data=valor, request=request)
    db.commit()
    return out


@r.post("/timbrado/arquivo")
async def enviar_timbrado(request: Request, arquivo: UploadFile = File(...), continuacao: bool = False,
                          db: Session = Depends(get_db), cu: CurrentUser = Depends(require("configuracoes.editar"))):
    """Papel timbrado: imagem (PNG/JPG em A4) ou PDF de 1 página aplicado como fundo."""
    meta = await storage.save_upload(arquivo, allowed={"image/png", "image/jpeg", "application/pdf"})
    a = Arquivo(**meta, entidade="timbrado", entidade_id=0, enviado_por_id=cu.id)
    db.add(a)
    db.flush()
    campo = "arquivo_continuacao_id" if continuacao else "arquivo_id"
    service.set_config(db, "timbrado", {campo: a.id})
    audit.log(db, user_id=cu.id, action="timbrado", entity="configuracao", entity_id="timbrado", request=request)
    db.commit()
    return service.get_config(db, "timbrado")


@r.post("/logo")
async def enviar_logo(arquivo: UploadFile = File(...), db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("configuracoes.editar"))):
    meta = await storage.save_upload(arquivo, allowed={"image/png", "image/jpeg", "image/webp"})
    a = Arquivo(**meta, entidade="logo", entidade_id=0, enviado_por_id=cu.id)
    db.add(a)
    db.flush()
    service.set_config(db, "empresa", {"logo_arquivo_id": a.id})
    db.commit()
    return service.get_config(db, "empresa")


@pub.get("/marca")
def marca(db: Session = Depends(get_db)):
    """Dados mínimos para a tela de login (sem informações sensíveis)."""
    e = service.get_config(db, "empresa")
    return {"nome": e.get("nome_fantasia") or e.get("razao_social"), "cor_primaria": e.get("cor_primaria"),
            "tem_logo": bool(e.get("logo_arquivo_id"))}


@pub.get("/logo")
def logo(db: Session = Depends(get_db)):
    e = service.get_config(db, "empresa")
    a = db.get(Arquivo, e.get("logo_arquivo_id") or 0)
    if not a:
        raise HTTPException(404, "Sem logo")
    return Response(storage.read_bytes(a.uuid), media_type=a.mime, headers={"Cache-Control": "public, max-age=3600"})


def logo_data_uri(db: Session) -> str | None:
    e = service.get_config(db, "empresa")
    a = db.get(Arquivo, e.get("logo_arquivo_id") or 0)
    if not a:
        return None
    return f"data:{a.mime};base64,{base64.b64encode(storage.read_bytes(a.uuid)).decode()}"


# ---------------- Integrações ----------------
ri = APIRouter(prefix="/integracoes", tags=["integrações"])


class IntegracaoIn(BaseModel):
    config: dict = {}
    segredo: str | None = None
    webhook_secret: str | None = None
    limpar_segredo: bool = False


@ri.get("")
def listar_integracoes(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("configuracoes.ver"))):
    out = {}
    for k, default in INTEGRACOES.items():
        cfg, seg = service.get_integracao(db, k)
        cfg = {**default, **{c: v for c, v in cfg.items() if c != "webhook_secret"}}
        out[k] = {"config": cfg, "segredo_definido": bool(seg)}
    return out


@ri.put("/{chave}")
def salvar_integracao(chave: str, body: IntegracaoIn, request: Request, db: Session = Depends(get_db),
                      cu: CurrentUser = Depends(require("configuracoes.editar"))):
    if chave not in INTEGRACOES:
        raise HTTPException(404, "Integração inexistente")
    atual, _ = service.get_integracao(db, chave)
    cfg = {k: v for k, v in body.config.items() if k in INTEGRACOES[chave] and k != "webhook_secret_definido"}
    base = cfg.get("base_url")
    if base and not str(base).startswith(("https://", "http://")):
        raise HTTPException(422, "URL deve começar com http:// ou https://")
    if body.webhook_secret:
        cfg["webhook_secret"] = body.webhook_secret
    elif "webhook_secret" in atual:
        cfg["webhook_secret"] = atual["webhook_secret"]
    cfg["webhook_secret_definido"] = bool(cfg.get("webhook_secret"))
    service.set_integracao(db, chave, cfg, body.segredo, body.limpar_segredo)
    audit.log(db, user_id=cu.id, action="configurar_integracao", entity="integracao", entity_id=chave,
              data={k: v for k, v in cfg.items() if k != "webhook_secret"}, request=request)
    db.commit()
    return {"ok": True}


# ---------------- Painel ----------------
rd = APIRouter(prefix="/painel", tags=["painel"])


@rd.get("")
def painel(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    from app.core.scope import allowed_obra_ids

    hoje = date.today()
    out: dict = {"cards": [], "listas": {}}
    ids = allowed_obra_ids(db, cu)
    disabled = service.disabled_modules(db)

    def on(key: str, perm: str) -> bool:
        return key not in disabled and cu.has(perm)

    if on("obras", "obras.ver"):
        from app.modules.obras.models import Obra

        q = select(Obra).where(Obra.status == "em_andamento")
        if ids is not None:
            q = q.where(Obra.id.in_(ids or [-1]))
        ativas = db.scalars(q.order_by(Obra.data_prevista_fim.asc().nulls_last()).limit(8)).all()
        total = db.scalar(select(func.count()).select_from(q.subquery()))
        out["cards"].append({"chave": "obras", "titulo": "Obras em andamento", "valor": total, "link": "/obras"})
        out["listas"]["obras"] = [{"id": o.id, "nome": o.nome, "progresso": float(o.progresso or 0),
                                   "fim": o.data_prevista_fim, "cliente": o.cliente_nome} for o in ativas]
    if on("licitacoes", "licitacoes.ver"):
        from app.modules.licitacoes.models import Licitacao

        q = select(Licitacao).where(Licitacao.status.in_(["prospeccao", "em_analise", "documentacao", "proposta_enviada",
                                                          "em_disputa"]),
                                    Licitacao.data_abertura >= hoje)
        prox = db.scalars(q.order_by(Licitacao.data_abertura).limit(8)).all()
        out["cards"].append({"chave": "licitacoes", "titulo": "Licitações em aberto",
                             "valor": db.scalar(select(func.count()).select_from(q.subquery())), "link": "/licitacoes"})
        out["listas"]["licitacoes"] = [{"id": li.id, "objeto": li.objeto[:140], "orgao": li.orgao_nome,
                                        "abertura": li.data_abertura, "status": li.status} for li in prox]
    if on("financeiro", "financeiro.ver"):
        from app.modules.financeiro.models import Lancamento

        def soma(tipo, *conds):
            return float(db.scalar(select(func.coalesce(func.sum(Lancamento.valor - Lancamento.valor_pago), 0))
                                   .where(Lancamento.tipo == tipo, Lancamento.status.in_(["aberto", "parcial"]), *conds)) or 0)

        semana = hoje + timedelta(days=7)
        out["cards"] += [
            {"chave": "pagar7", "titulo": "A pagar (7 dias)", "valor": soma("despesa", Lancamento.vencimento <= semana),
             "formato": "moeda", "link": "/financeiro?tipo=despesa"},
            {"chave": "receber", "titulo": "A receber", "valor": soma("receita"), "formato": "moeda",
             "link": "/financeiro?tipo=receita"},
            {"chave": "atrasados", "titulo": "Contas vencidas", "valor": soma("despesa", Lancamento.vencimento < hoje),
             "formato": "moeda", "alerta": True, "link": "/financeiro?atrasados=1"},
        ]
    if on("frota", "frota.ver"):
        from app.modules.frota.module import alertas_frota

        out["listas"]["frota"] = alertas_frota(30, db, cu)
    if on("diario", "diario.ver"):
        from app.modules.diario.models import DiarioObra

        q = select(func.count()).where(DiarioObra.data == hoje)
        if ids is not None:
            q = q.where(DiarioObra.obra_id.in_(ids or [-1]))
        out["cards"].append({"chave": "diarios", "titulo": "Diários hoje", "valor": db.scalar(q), "link": "/diario"})
    if on("inventario", "inventario.ver"):
        from app.modules.inventario.module import saldos

        baixos = saldos(None, True, None, db, cu)
        out["cards"].append({"chave": "estoque", "titulo": "Itens abaixo do mínimo", "valor": len({b["item_id"] for b in baixos}),
                             "alerta": bool(baixos), "link": "/inventario"})
    return out


module = ModuleDef(key="sistema", label="Configurações", icon="settings", order=950, core=True,
                   routers=[r, ri, pub, rd, arquivos_router, localidades_router])
module.permissions += [
    Permission("configuracoes.ver", "Configurações: Visualizar", "sistema"),
    Permission("configuracoes.editar", "Configurações: Editar (empresa, timbrado, integrações, módulos)", "sistema"),
]
