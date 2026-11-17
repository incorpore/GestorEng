"""Clima pela API do OpenWeather: tempo atual da obra e sugestão de condições (manhã/tarde) para o diário."""
import time
from datetime import date, datetime
from statistics import mean

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, require
from app.core.imagens import fuso
from app.modules.sistema.service import get_integracao

router = APIRouter(prefix="/clima", tags=["clima"])
_cache: dict[str, tuple[float, dict]] = {}
TTL = 600

# condição do sistema, em ordem crescente de severidade
CONDICOES = ["bom", "parcialmente_nublado", "nublado", "garoa", "chuvoso", "tempestade"]


def condicao_por_codigo(codigo: int) -> str:
    """Converte o código de tempo do OpenWeather para a condição usada no diário."""
    if 200 <= codigo < 300:
        return "tempestade"
    if 300 <= codigo < 400:
        return "garoa"
    if 500 <= codigo < 700:
        return "chuvoso"
    if 700 <= codigo < 800:
        return "nublado"
    if codigo == 800:
        return "bom"
    if codigo in (801, 802):
        return "parcialmente_nublado"
    return "nublado"


def vento_categoria(ms: float | None) -> str:
    if ms is None or ms < 0.5:
        return "sem_vento"
    if ms < 5.5:
        return "fraco"
    if ms < 10.8:
        return "moderado"
    return "forte"


def condicao_trabalho(condicao: str) -> str:
    return {"tempestade": "impraticavel", "chuvoso": "parcial"}.get(condicao, "praticavel")


def _config(db: Session) -> tuple[str, str]:
    cfg, chave = get_integracao(db, "openweather")
    if not chave:
        raise HTTPException(400, "Integração com o OpenWeather não configurada (Configurações > Integrações)")
    return (cfg.get("base_url") or "https://api.openweathermap.org").rstrip("/"), chave


def _get(db: Session, caminho: str, params: dict) -> dict | list:
    base, chave = _config(db)
    key = caminho + repr(sorted(params.items()))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < TTL:
        return hit[1]
    try:
        with httpx.Client(timeout=15) as c:
            r = c.get(f"{base}{caminho}", params={**params, "appid": chave, "units": "metric", "lang": "pt_br"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Falha ao consultar o OpenWeather: {e.__class__.__name__}")
    if r.status_code == 401:
        raise HTTPException(400, "Chave do OpenWeather inválida ou ainda não ativada (pode levar até 2 horas após criar)")
    if r.status_code >= 400:
        raise HTTPException(502, f"OpenWeather retornou {r.status_code}")
    dados = r.json()
    _cache[key] = (time.monotonic(), dados)
    return dados


def coordenadas(db: Session, obra) -> tuple[float, float]:
    try:
        if obra.latitude and obra.longitude:
            return float(obra.latitude), float(obra.longitude)
    except ValueError:
        pass
    if not obra.cidade:
        raise HTTPException(422, "Cadastre as coordenadas ou a cidade/UF da obra para consultar o clima")
    q = f"{obra.cidade},{obra.uf},BR" if obra.uf else f"{obra.cidade},BR"
    res = _get(db, "/geo/1.0/direct", {"q": q, "limit": 1})
    if not res:
        raise HTTPException(422, f"Cidade não encontrada no OpenWeather: {obra.cidade}")
    return float(res[0]["lat"]), float(res[0]["lon"])


def _hora(ts: int | None) -> str | None:
    return datetime.fromtimestamp(ts, fuso()).strftime("%H:%M") if ts else None


def atual(db: Session, lat: float, lon: float) -> dict:
    d = _get(db, "/data/2.5/weather", {"lat": round(lat, 4), "lon": round(lon, 4)})
    w = (d.get("weather") or [{}])[0]
    m = d.get("main") or {}
    vento = (d.get("wind") or {}).get("speed")
    cond = condicao_por_codigo(int(w.get("id", 800)))
    return {
        "descricao": (w.get("description") or "").capitalize(), "icone": w.get("icon"), "condicao": cond,
        "temp": m.get("temp"), "temp_min": m.get("temp_min"), "temp_max": m.get("temp_max"),
        "umidade": m.get("humidity"), "vento_ms": vento, "vento": vento_categoria(vento),
        "nascer": _hora((d.get("sys") or {}).get("sunrise")), "por": _hora((d.get("sys") or {}).get("sunset")),
        "local": d.get("name"), "consultado_em": datetime.now(fuso()).isoformat(timespec="minutes"),
    }


def _agregar(itens: list[dict]) -> dict | None:
    if not itens:
        return None
    conds = [condicao_por_codigo(int((i.get("weather") or [{}])[0].get("id", 800))) for i in itens]
    vento = max((i.get("wind") or {}).get("speed", 0) for i in itens)
    return {
        "condicao": max(conds, key=CONDICOES.index),
        "temp_min": round(min(i["main"]["temp_min"] for i in itens), 1),
        "temp_max": round(max(i["main"]["temp_max"] for i in itens), 1),
        "umidade": round(mean(i["main"]["humidity"] for i in itens)),
        "vento": vento_categoria(vento), "vento_ms": round(vento, 1),
    }


def periodos(db: Session, lat: float, lon: float, dia: date) -> dict:
    """Condições de manhã (6h-12h) e tarde (12h-18h) para hoje ou os próximos 5 dias."""
    hoje = datetime.now(fuso()).date()
    if dia < hoje or (dia - hoje).days > 5:
        raise HTTPException(409, "O OpenWeather fornece dados apenas para hoje e os próximos 5 dias; preencha manualmente.")
    lista = _get(db, "/data/2.5/forecast", {"lat": round(lat, 4), "lon": round(lon, 4)}).get("list") or []
    manha, tarde = [], []
    for item in lista:
        t = datetime.fromtimestamp(item["dt"], fuso())
        if t.date() != dia:
            continue
        if 6 <= t.hour < 12:
            manha.append(item)
        elif 12 <= t.hour < 18:
            tarde.append(item)
    agora = atual(db, lat, lon) if dia == hoje else None
    resultado = {"manha": _agregar(manha), "tarde": _agregar(tarde), "atual": agora}
    if agora:
        # períodos já passados de hoje não estão na previsão: usa o tempo atual
        fallback = {k: agora[k] for k in ("condicao", "temp_min", "temp_max", "umidade", "vento", "vento_ms")}
        hora = datetime.now(fuso()).hour
        if resultado["manha"] is None and hora >= 6:
            resultado["manha"] = fallback
        if resultado["tarde"] is None and hora >= 12:
            resultado["tarde"] = fallback
    pior = max((p["condicao"] for p in (resultado["manha"], resultado["tarde"]) if p), key=CONDICOES.index, default="bom")
    resultado["condicao_trabalho"] = condicao_trabalho(pior)
    return resultado


def _obra(db: Session, cu: CurrentUser, obra_id: int):
    from .module import obras

    return obras.get_or_404(db, cu, obra_id)


@router.get("/obra/{obra_id}")
def clima_obra(obra_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require("obras.ver"))):
    lat, lon = coordenadas(db, _obra(db, cu, obra_id))
    return {**atual(db, lat, lon), "latitude": lat, "longitude": lon}


@router.get("/obra/{obra_id}/periodos")
def clima_periodos(obra_id: int, data: date, db: Session = Depends(get_db),
                   cu: CurrentUser = Depends(require("diario.ver"))):
    lat, lon = coordenadas(db, _obra(db, cu, obra_id))
    return periodos(db, lat, lon, data)


@router.post("/testar")
def testar(db: Session = Depends(get_db), cu: CurrentUser = Depends(require("configuracoes.editar"))):
    d = atual(db, -15.7939, -47.8828)
    return {"ok": True, "exemplo": f"Brasília: {d['descricao']}, {d['temp']} °C"}
