"""Detecção dos campos de assinatura em PDFs.

1. Lê o texto do PDF com a posição de cada linha (em % da página, origem no canto superior esquerdo).
2. Com a IA configurada (OpenRouter), envia o mapa de linhas e os assinantes e pede o retângulo de cada assinatura.
3. Sem IA (ou se ela falhar), procura o nome de cada assinante e/ou uma linha "____" e posiciona o campo logo acima.
O resultado é sempre validado (dentro da página, tamanho mínimo/máximo) antes de ir ao Documenso.
"""
import io
import json
import logging
import re
import unicodedata
from dataclasses import asdict, dataclass

from pypdf import PdfReader

log = logging.getLogger(__name__)

LARGURA_PADRAO, ALTURA_PADRAO = 28.0, 6.0
MAX_LINHAS_IA = 700


@dataclass
class Linha:
    pagina: int  # 1..n
    x: float  # % da largura (canto esquerdo do texto)
    y: float  # % da altura, a partir do topo (base da linha de texto)
    largura: float  # % estimado
    texto: str


@dataclass
class Campo:
    indice: int  # posição do assinante na lista
    pagina: int
    x: float
    y: float
    largura: float
    altura: float
    origem: str  # ia | texto | padrao
    referencia: str = ""


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "") if unicodedata.category(c) != "Mn").casefold()


def tamanhos(pdf: bytes) -> list[dict]:
    r = PdfReader(io.BytesIO(pdf))
    return [{"largura": float(p.mediabox.width), "altura": float(p.mediabox.height)} for p in r.pages]


def linhas(pdf: bytes) -> list[Linha]:
    """Texto do PDF agrupado em linhas, com posição em % da página."""
    leitor = PdfReader(io.BytesIO(pdf))
    saida: list[Linha] = []
    for n, pagina in enumerate(leitor.pages, start=1):
        larg, alt = float(pagina.mediabox.width), float(pagina.mediabox.height)
        x0, y0 = float(pagina.mediabox.left), float(pagina.mediabox.bottom)
        pedacos: list[tuple[float, float, float, str]] = []

        def visitante(texto, cm, tm, fonte, tamanho, _p=pedacos):
            if not texto or not texto.strip():
                return
            # posição = tm × cm (matriz de texto no espaço da página)
            a, b, c, d, e, f = tm
            A, B, C, D, E, F = cm
            x = e * A + f * C + E
            y = e * B + f * D + F
            escala = (abs(a * A + b * C) or 1) * (tamanho or 10)
            _p.append((x, y, escala, texto))

        try:
            pagina.extract_text(visitor_text=visitante)
        except Exception:  # noqa: BLE001 — PDF com fontes estranhas: segue sem esta página
            log.warning("Não foi possível ler o texto da página %s", n)
            continue
        # agrupa por linha (mesma altura, tolerância de 2 pt)
        pedacos.sort(key=lambda p: (-round(p[1] / 2), p[0]))
        atual: list[tuple[float, float, float, str]] = []
        pag = (n, larg, alt, x0, y0)
        for p in pedacos:
            if atual and abs(p[1] - atual[0][1]) > 2:
                saida += _fechar_linha(atual, pag)
                atual = []
            atual.append(p)
        saida += _fechar_linha(atual, pag)
    return _dividir_tracos(saida)


def _fim(p: tuple) -> float:
    return p[0] + len(p[3].strip()) * p[2] * 0.5


def _fechar_linha(atual: list[tuple], pag: tuple) -> list[Linha]:
    """Trechos da mesma altura viram linhas; colunas (ex.: assinaturas lado a lado) são separadas pelo espaço entre elas."""
    n, larg, alt, x0, y0 = pag
    grupos: list[list] = []
    for p in sorted(atual, key=lambda q: q[0]):
        if grupos and p[0] - max(_fim(q) for q in grupos[-1]) <= larg * 0.04:
            grupos[-1].append(p)
        else:
            grupos.append([p])
    out = []
    for g in grupos:
        texto = " ".join(" ".join(p[3].split()) for p in g).strip()
        if not texto:
            continue
        xs, fim, y = min(p[0] for p in g), max(_fim(p) for p in g), g[0][1]
        out.append(Linha(n, round((xs - x0) / larg * 100, 2), round((alt - (y - y0)) / alt * 100, 2),
                         round(max(fim - xs, 1) / larg * 100, 2), texto[:200]))
    return out


def _dividir_tracos(lins: list[Linha]) -> list[Linha]:
    """Um trecho com várias linhas de assinatura ("____  ____") vira um item por linha, na posição proporcional."""
    out: list[Linha] = []
    for linha in lins:
        runs = list(re.finditer(r"_{6,}", linha.texto))
        if len(runs) < 2:
            out.append(linha)
            continue
        total = len(linha.texto)
        for m in runs:
            out.append(Linha(linha.pagina, round(linha.x + linha.largura * m.start() / total, 2), linha.y,
                             round(linha.largura * (m.end() - m.start()) / total, 2), m.group(0)))
    return out


def _limitar(c: Campo) -> Campo:
    c.largura = min(max(c.largura, 12), 60)
    c.altura = min(max(c.altura, 3), 15)
    c.x = min(max(c.x, 0), 100 - c.largura)
    c.y = min(max(c.y, 0), 100 - c.altura)
    for k in ("x", "y", "largura", "altura"):
        setattr(c, k, round(getattr(c, k), 2))
    return c


def _acima(linha: Linha, indice: int, origem: str, ref: str, lins: list[Linha] | None = None) -> Campo:
    """Campo centralizado sobre a linha de referência, logo acima dela; a altura se ajusta ao espaço livre até o
    texto de cima (para não cobrir o texto)."""
    centro = linha.x + linha.largura / 2
    esq, dir_ = centro - LARGURA_PADRAO / 2, centro + LARGURA_PADRAO / 2
    base = linha.y - 0.6
    acima = [o.y for o in (lins or []) if o.pagina == linha.pagina and o.y < base - 0.5
             and o.x < dir_ and o.x + o.largura > esq]
    altura = ALTURA_PADRAO if not acima else min(ALTURA_PADRAO, max(3.0, base - max(acima) - 0.5))
    return _limitar(Campo(indice, linha.pagina, esq, base - altura, LARGURA_PADRAO, altura, origem, ref))


def por_texto(lins: list[Linha], assinantes: list[dict]) -> list[Campo]:
    """Sem IA: acha o nome do assinante (a ocorrência mais abaixo, onde fica o bloco de assinatura) ou uma linha
    de sublinhado ainda livre, e posiciona o campo logo acima."""
    campos: list[Campo] = []
    usadas: set[int] = set()
    traco = [i for i, linha in enumerate(lins) if re.search(r"_{8,}", linha.texto)]
    for idx, a in enumerate(assinantes):
        if a.get("papel", "SIGNER") != "SIGNER":
            continue
        nome = _sem_acento(a.get("nome", "")).strip()
        achados = [i for i, linha in enumerate(lins) if nome and nome in _sem_acento(linha.texto)]
        # prefere o nome que tem uma linha "____" logo acima (bloco de assinatura)
        def centro(k):
            return lins[k].x + lins[k].largura / 2

        def traco_acima(i):
            """Linha de sublinhado logo acima do nome, a mais próxima na horizontal."""
            cands = [j for j in traco if j not in usadas and lins[j].pagina == lins[i].pagina
                     and 0 < lins[i].y - lins[j].y < 4 and abs(centro(j) - centro(i)) < 20]
            return min(cands, key=lambda j: abs(centro(j) - centro(i)), default=None)

        achados.sort(key=lambda i: (traco_acima(i) is None, -lins[i].pagina, -lins[i].y))
        if achados:
            i = achados[0]
            alvo = traco_acima(i)
            linha = lins[alvo] if alvo is not None else lins[i]
            if alvo is not None:
                usadas.add(alvo)
            campos.append(_acima(linha, idx, "texto", lins[i].texto, lins))
            continue
        livre = next((j for j in reversed(traco) if j not in usadas), None)
        if livre is not None:
            usadas.add(livre)
            campos.append(_acima(lins[livre], idx, "texto", "linha de assinatura", lins))
    return campos


PROMPT = """Você localiza onde cada pessoa deve assinar em um documento PDF.
Recebe as linhas de texto do PDF com posição em porcentagem da página (x = esquerda do texto, y = base da linha a
partir do TOPO, largura estimada) e a lista de assinantes.
Para cada assinante do tipo SIGNER, encontre o local da assinatura dele: normalmente uma linha de sublinhados
("_____") com o nome (ou cargo/empresa) da pessoa logo abaixo, ou palavras como "Assinatura", "Contratante",
"Responsável técnico", "Fiscal". O campo deve ficar SOBRE a linha de sublinhado (o retângulo termina logo acima dela),
centralizado nela. Use largura entre 20 e 35 e altura entre 5 e 7. Não sobreponha campos de pessoas diferentes.
Se não houver local claro para alguém, omita essa pessoa.
Responda SOMENTE com JSON no formato:
{"campos": [{"assinante": <índice>, "pagina": <n>, "x": <%>, "y": <%>, "largura": <%>, "altura": <%>, "referencia": "<texto usado como referência>"}]}"""


def por_ia(chamar, lins: list[Linha], assinantes: list[dict], n_paginas: int) -> list[Campo]:
    """chamar(messages) -> str: função da integração de IA."""
    # prioriza as últimas linhas (blocos de assinatura costumam ficar no fim) quando o documento é grande
    selecionadas = lins if len(lins) <= MAX_LINHAS_IA else lins[-MAX_LINHAS_IA:]
    mapa = "\n".join(f"p{linha.pagina} x={linha.x} y={linha.y} w={linha.largura} | {linha.texto}" for linha in selecionadas)
    pessoas = "\n".join(f"{i}: {a.get('nome')} <{a.get('email')}> papel={a.get('papel', 'SIGNER')}"
                        for i, a in enumerate(assinantes))
    resposta = chamar([{"role": "system", "content": PROMPT},
                       {"role": "user", "content": f"Páginas: {n_paginas}\n\nAssinantes:\n{pessoas}\n\nLinhas do PDF:\n{mapa}"}])
    m = re.search(r"\{.*\}", resposta or "", re.S)
    if not m:
        raise ValueError("a IA não devolveu JSON")
    dados = json.loads(m.group(0))
    campos: list[Campo] = []
    vistos: set[int] = set()
    for c in dados.get("campos") or []:
        try:
            idx, pag = int(c["assinante"]), int(c["pagina"])
            if idx in vistos or not (0 <= idx < len(assinantes)) or not (1 <= pag <= n_paginas):
                continue
            if assinantes[idx].get("papel", "SIGNER") != "SIGNER":
                continue
            campos.append(_limitar(Campo(idx, pag, float(c["x"]), float(c["y"]), float(c.get("largura") or LARGURA_PADRAO),
                                         float(c.get("altura") or ALTURA_PADRAO), "ia", str(c.get("referencia") or "")[:120])))
            vistos.add(idx)
        except (KeyError, TypeError, ValueError):
            continue
    return campos


def detectar(pdf: bytes, assinantes: list[dict], chamar=None) -> dict:
    """Retorna {"campos": [...], "paginas": [...], "metodo": "ia"|"texto", "aviso": str|None}."""
    lins = linhas(pdf)
    paginas = tamanhos(pdf)
    aviso, metodo = None, "texto"
    campos: list[Campo] = []
    if not lins:
        aviso = "O PDF não tem texto legível (pode ser digitalizado). Posicione as assinaturas manualmente."
    elif chamar is not None:
        try:
            campos, metodo = por_ia(chamar, lins, assinantes, len(paginas)), "ia"
        except Exception as e:  # noqa: BLE001 — a busca por texto assume
            log.warning("Detecção por IA falhou: %s", e)
            aviso = f"A IA não respondeu como esperado ({getattr(e, 'detail', e)}); usada a busca pelo texto do PDF."
    if lins:
        # completa quem a IA não encontrou (ou tudo, sem IA) pela busca no texto
        faltam = [i for i, a in enumerate(assinantes) if a.get("papel", "SIGNER") == "SIGNER"
                  and i not in {c.indice for c in campos}]
        if faltam:
            extras = [c for c in por_texto(lins, assinantes) if c.indice in faltam]
            campos += extras
    campos.sort(key=lambda c: c.indice)
    return {"campos": [asdict(c) for c in campos], "paginas": paginas, "metodo": metodo, "aviso": aviso}
