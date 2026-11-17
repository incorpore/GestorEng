"""Cliente da API pública de consultas do PNCP (Portal Nacional de Contratações Públicas).

Documentação: https://pncp.gov.br/api/consulta/swagger-ui/index.html
"""
import unicodedata
from datetime import date, timedelta

import httpx
from fastapi import HTTPException

BASE = "https://pncp.gov.br/api/consulta/v1"

MODALIDADES = {
    1: "Leilão - Eletrônico", 2: "Diálogo Competitivo", 3: "Concurso", 4: "Concorrência - Eletrônica",
    5: "Concorrência - Presencial", 6: "Pregão - Eletrônico", 7: "Pregão - Presencial",
    8: "Dispensa de Licitação", 9: "Inexigibilidade", 10: "Manifestação de Interesse",
    11: "Pré-qualificação", 12: "Credenciamento", 13: "Leilão - Presencial",
}


def _norm(s: str) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


def _get(path: str, params: dict) -> dict:
    try:
        with httpx.Client(timeout=30, headers={"Accept": "application/json", "User-Agent": "Struvia/1.0"}) as c:
            r = c.get(f"{BASE}{path}", params={k: v for k, v in params.items() if v not in (None, "")})
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Falha ao consultar o PNCP: {e.__class__.__name__}")
    if r.status_code == 204:
        return {"data": [], "totalRegistros": 0, "totalPaginas": 0, "numeroPagina": params.get("pagina", 1)}
    if r.status_code >= 400:
        raise HTTPException(424, f"PNCP retornou erro {r.status_code}: {r.text[:300]}")
    return r.json()


def normalizar(item: dict) -> dict:
    orgao = item.get("orgaoEntidade") or {}
    unidade = item.get("unidadeOrgao") or {}
    cnpj, ano, seq = orgao.get("cnpj"), item.get("anoCompra"), item.get("sequencialCompra")
    return {
        "pncp_controle": item.get("numeroControlePNCP"),
        "numero": item.get("numeroCompra") and f"{item.get('numeroCompra')}/{ano}",
        "orgao_nome": orgao.get("razaoSocial"),
        "orgao_cnpj": cnpj,
        "modalidade": item.get("modalidadeNome"),
        "objeto": item.get("objetoCompra") or "",
        "uf": unidade.get("ufSigla"),
        "municipio": unidade.get("municipioNome"),
        "data_publicacao": item.get("dataPublicacaoPncp"),
        "data_abertura": item.get("dataAberturaProposta"),
        "data_encerramento_proposta": item.get("dataEncerramentoProposta"),
        "valor_estimado": item.get("valorTotalEstimado") or 0,
        "situacao": item.get("situacaoCompraNome"),
        "link_sistema": item.get("linkSistemaOrigem"),
        "link_edital": f"https://pncp.gov.br/app/editais/{cnpj}/{ano}/{seq}" if cnpj and ano and seq else None,
    }


def buscar_abertas(*, modalidade: int, uf: str | None = None, municipio_ibge: str | None = None,
                   palavras: str | None = None, data_final: date | None = None, pagina: int = 1,
                   tamanho: int = 50) -> dict:
    """Contratações com período de recebimento de propostas em aberto."""
    data_final = data_final or (date.today() + timedelta(days=60))
    raw = _get("/contratacoes/proposta", {
        "dataFinal": data_final.strftime("%Y%m%d"),
        "codigoModalidadeContratacao": modalidade,
        "uf": uf, "codigoMunicipioIbge": municipio_ibge,
        "pagina": pagina, "tamanhoPagina": max(10, min(tamanho, 50)),
    })
    return _filtrar(raw, palavras)


def buscar_publicadas(*, modalidade: int, data_inicial: date, data_final: date, uf: str | None = None,
                      municipio_ibge: str | None = None, palavras: str | None = None, pagina: int = 1,
                      tamanho: int = 50) -> dict:
    raw = _get("/contratacoes/publicacao", {
        "dataInicial": data_inicial.strftime("%Y%m%d"), "dataFinal": data_final.strftime("%Y%m%d"),
        "codigoModalidadeContratacao": modalidade, "uf": uf, "codigoMunicipioIbge": municipio_ibge,
        "pagina": pagina, "tamanhoPagina": max(10, min(tamanho, 50)),
    })
    return _filtrar(raw, palavras)


def _filtrar(raw: dict, palavras: str | None) -> dict:
    itens = [normalizar(i) for i in raw.get("data") or []]
    if palavras:
        termos = [_norm(t) for t in palavras.split(",") if t.strip()]
        itens = [i for i in itens if any(t.strip() in _norm(i["objeto"]) for t in termos)]
    return {
        "itens": itens,
        "total_registros": raw.get("totalRegistros", 0),
        "total_paginas": raw.get("totalPaginas", 0),
        "pagina": raw.get("numeroPagina", 1),
    }


def detalhe(cnpj: str, ano: int, sequencial: int) -> dict:
    return _get(f"/orgaos/{cnpj}/compras/{ano}/{sequencial}", {})


BASE_PNCP = "https://pncp.gov.br/api/pncp/v1"


def _get_pncp(path: str) -> list | dict:
    try:
        with httpx.Client(timeout=30, headers={"Accept": "application/json", "User-Agent": "Struvia/1.0"}) as c:
            r = c.get(f"{BASE_PNCP}{path}", params={"pagina": 1, "tamanhoPagina": 500} if path.endswith("itens") else None)
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Falha ao consultar o PNCP: {e.__class__.__name__}")
    if r.status_code >= 400:
        raise HTTPException(424, f"PNCP retornou erro {r.status_code}")
    return r.json() if r.content else []


def arquivos(cnpj: str, ano: int, sequencial: int):
    return _get_pncp(f"/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos")


def itens(cnpj: str, ano: int, sequencial: int):
    return _get_pncp(f"/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens")
