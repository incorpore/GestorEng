"""Estados e municípios do Brasil pela API pública do IBGE (com cache no banco)."""
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user

from .models import CacheExterno

router = APIRouter(prefix="/localidades", tags=["localidades"])
IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades"
VALIDADE = timedelta(days=30)

ESTADOS = [  # usado se o IBGE estiver fora do ar e ainda não houver cache
    (12, "AC", "Acre"), (27, "AL", "Alagoas"), (16, "AP", "Amapá"), (13, "AM", "Amazonas"), (29, "BA", "Bahia"),
    (23, "CE", "Ceará"), (53, "DF", "Distrito Federal"), (32, "ES", "Espírito Santo"), (52, "GO", "Goiás"),
    (21, "MA", "Maranhão"), (51, "MT", "Mato Grosso"), (50, "MS", "Mato Grosso do Sul"), (31, "MG", "Minas Gerais"),
    (15, "PA", "Pará"), (25, "PB", "Paraíba"), (41, "PR", "Paraná"), (26, "PE", "Pernambuco"), (22, "PI", "Piauí"),
    (33, "RJ", "Rio de Janeiro"), (24, "RN", "Rio Grande do Norte"), (43, "RS", "Rio Grande do Sul"),
    (11, "RO", "Rondônia"), (14, "RR", "Roraima"), (42, "SC", "Santa Catarina"), (35, "SP", "São Paulo"),
    (28, "SE", "Sergipe"), (17, "TO", "Tocantins"),
]
UFS = {sigla for _, sigla, _ in ESTADOS}


def _buscar(url: str) -> list:
    with httpx.Client(timeout=20, headers={"Accept": "application/json", "User-Agent": "Struvia/1.0"}) as c:
        r = c.get(url, params={"orderBy": "nome"})
    r.raise_for_status()
    return r.json()


def cache(db: Session, chave: str, url: str, transformar) -> list:
    row = db.get(CacheExterno, chave)
    agora = datetime.now(UTC)
    if row and row.atualizado_em and row.atualizado_em > agora - VALIDADE:
        return row.dados
    try:
        dados = transformar(_buscar(url))
    except (httpx.HTTPError, ValueError, KeyError):
        if row:
            return row.dados  # usa cache vencido se o IBGE estiver indisponível
        raise
    if row is None:
        row = CacheExterno(chave=chave)
        db.add(row)
    row.dados, row.atualizado_em = dados, agora
    db.commit()
    return dados


@router.get("/estados")
def estados(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    try:
        return cache(db, "ibge:estados", f"{IBGE}/estados",
                     lambda d: sorted(({"id": e["id"], "sigla": e["sigla"], "nome": e["nome"]} for e in d), key=lambda x: x["nome"]))
    except (httpx.HTTPError, ValueError, KeyError):
        return [{"id": i, "sigla": s, "nome": n} for i, s, n in ESTADOS]


@router.get("/municipios")
def municipios(uf: str = Query(min_length=2, max_length=2), db: Session = Depends(get_db),
               cu: CurrentUser = Depends(get_current_user)):
    uf = uf.upper()
    if uf not in UFS:
        raise HTTPException(422, "UF inválida")
    try:
        return cache(db, f"ibge:municipios:{uf}", f"{IBGE}/estados/{uf}/municipios",
                     lambda d: [{"id": m["id"], "nome": m["nome"]} for m in d])
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, "Não foi possível consultar os municípios no IBGE. Tente novamente.")
