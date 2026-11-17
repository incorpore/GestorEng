"""Blocos HTML reutilizados no PDF do diário e na cartilha."""
from datetime import date
from html import escape

from app.modules.documentos.render import MESES, f_data, f_numero

COND = {"bom": "Céu limpo", "parcialmente_nublado": "Parcialmente nublado", "nublado": "Nublado", "garoa": "Garoa",
        "chuvoso": "Chuvoso", "tempestade": "Tempestade", "impraticavel": "Impraticável"}
VENTO = {"sem_vento": "sem vento", "fraco": "vento fraco", "moderado": "vento moderado", "forte": "vento forte"}
TRABALHO = {"praticavel": ("Praticável", "#166534"), "parcial": ("Parcialmente praticável", "#92400e"),
            "impraticavel": ("Impraticável", "#991b1b")}
DIAS_LONGOS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
OCORRENCIA = {"acidente": "Acidente", "paralisacao": "Paralisação", "interferencia": "Interferência",
              "seguranca": "Segurança", "outro": "Outro"}

_SOL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#f59e0b"/><g stroke="#f59e0b" stroke-width="2">' \
       '<path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g></svg>'
_NUVEM = '<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z" fill="#94a3b8"/></svg>'
_PARCIAL = '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4" fill="#f59e0b"/><path d="M8 19h10a3.5 3.5 0 0 0 .3-7 ' \
           '5 5 0 0 0-9.6 1A3 3 0 0 0 8 19z" fill="#94a3b8"/></svg>'
_CHUVA = '<svg viewBox="0 0 24 24"><path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14z" fill="#64748b"/>' \
         '<path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/></svg>'
_RAIO = '<svg viewBox="0 0 24 24"><path d="M7 13h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 4.5 4.3 4.3 0 0 0 7 13z" fill="#475569"/>' \
        '<path d="M13 13l-3 5h3l-2 5 5-7h-3l2-3z" fill="#f59e0b"/></svg>'
ICONE = {"bom": _SOL, "parcialmente_nublado": _PARCIAL, "nublado": _NUVEM, "garoa": _CHUVA, "chuvoso": _CHUVA,
         "tempestade": _RAIO, "impraticavel": _RAIO}


def e(v) -> str:
    return escape(str(v)) if v not in (None, "") else ""


def data_longa(d: date) -> str:
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def dia_semana(d: date) -> str:
    return DIAS_LONGOS[d.weekday()]


def bloco(titulo: str, corpo: str, qtd: int | None = None) -> str:
    q = f'<span class="qtd">{qtd} registro(s)</span>' if qtd else ""
    return f'<div class="bloco"><h3><span class="marcador"></span>{e(titulo)}{q}</h3>{corpo}</div>'


def tabela(cabecalho: list[str], linhas: list[list[str]], num: set[int] | None = None) -> str:
    num = num or set()
    th = "".join(f'<th class="{"num" if i in num else ""}">{e(c)}</th>' for i, c in enumerate(cabecalho))
    tr = "".join("<tr>" + "".join(f'<td class="{"num" if i in num else ""}">{c}</td>' for i, c in enumerate(lin)) + "</tr>"
                 for lin in linhas)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>"


def clima(d: dict) -> str:
    det = d.get("clima_detalhe") or {}
    periodos = []
    for chave, rot in (("manha", "Manhã"), ("tarde", "Tarde"), ("noite", "Noite")):
        p = det.get(chave) or {}
        cond = p.get("condicao") or d.get(f"clima_{chave}")
        if not cond and chave == "noite":
            continue
        pills = []
        if p.get("temp_min") is not None or p.get("temp_max") is not None:
            pills.append(f'{f_numero(p.get("temp_min"), 1)}° / {f_numero(p.get("temp_max"), 1)}°C')
        if p.get("umidade") is not None:
            pills.append(f'umidade {f_numero(p.get("umidade"), 0)}%')
        if p.get("vento"):
            pills.append(VENTO.get(p["vento"], p["vento"]))
        corpo = (f'<div class="cond">{ICONE.get(cond, "")}{e(COND.get(cond, "Não informado"))}</div>'
                 + "".join(f'<span class="pill">{e(x)}</span>' for x in pills)) if cond else '<p class="vazio">Não informado</p>'
        periodos.append(f'<div class="periodo"><div class="rot">{rot}</div>{corpo}</div>')
    trab, cor = TRABALHO.get(d.get("condicao") or "praticavel", TRABALHO["praticavel"])
    return (f'<div class="clima">{"".join(periodos)}</div>'
            f'<div class="trabalho">Condição de trabalho: <b style="color:{cor}">{trab}</b></div>')


def equipe(lista: list[dict]) -> str:
    if not lista:
        return ""
    linhas = [[e(x.get("nome")) or "—", e(x.get("funcao")), e("Própria" if (x.get("empresa") or "propria") == "propria"
                                                              else x.get("empresa")),
               e(x.get("quantidade") if (x.get("quantidade") or 1) > 1 else ""),
               f_numero(x.get("horas"), 1) if x.get("horas") is not None else ""] for x in lista]
    total = sum(int(x.get("quantidade") or 1) for x in lista)
    return bloco("Equipe", tabela(["Nome", "Função", "Empresa", "Qtd.", "Horas"], linhas, {3, 4}), total)


def maquinas(lista: list[dict]) -> str:
    if not lista:
        return ""
    linhas = [[e(x.get("descricao")), e(x.get("quantidade") or 1),
               f_numero(x.get("horas"), 1) if x.get("horas") is not None else ""] for x in lista]
    return bloco("Máquinas e equipamentos", tabela(["Descrição", "Qtd.", "Horas"], linhas, {1, 2}), len(lista))


def materiais(lista: list[dict], texto: str | None = None) -> str:
    corpo = ""
    if lista:
        linhas = [[e(x.get("descricao")), f"{f_numero(x.get('quantidade'), 2) if x.get('quantidade') is not None else ''} "
                                          f"{e(x.get('unidade'))}", e(x.get("observacao"))] for x in lista]
        corpo += tabela(["Material", "Quantidade", "Observação"], linhas, {1})
    if texto:
        corpo += f'<p class="texto">{e(texto)}</p>'
    return bloco("Materiais", corpo, len(lista) or None) if corpo else ""


def servicos(lista: list[dict]) -> str:
    if not lista:
        return ""
    linhas = []
    for x in lista:
        p = float(x.get("percentual") or 0)
        cls = "ok" if p >= 100 else ""
        barra = f'<div class="barra {cls}"><i style="width:{min(p, 100):.0f}%"></i></div>'
        obs = f'<br><small>{e(x.get("observacao"))}</small>' if x.get("observacao") else ""
        linhas.append([f"{e(x.get('descricao'))}{obs}", e(x.get("local")), f"<b>{p:.0f}%</b>{barra}"])
    return bloco("Serviços", tabela(["Descrição", "Local", "Avanço"], linhas, {2}), len(lista))


def visitas(lista: list[dict], texto: str | None = None) -> str:
    corpo = tabela(["Visitante", "Empresa", "Motivo"], [[e(x.get("visitante")), e(x.get("empresa")), e(x.get("motivo"))]
                                                         for x in lista]) if lista else ""
    if texto:
        corpo += f'<p class="texto">{e(texto)}</p>'
    return bloco("Visitas", corpo, len(lista) or None) if corpo else ""


def ocorrencias(lista: list[dict], texto: str | None = None) -> str:
    corpo = tabela(["Ocorrência", "Tipo", "Gravidade"],
                   [[e(x.get("descricao")), e(OCORRENCIA.get(x.get("tipo"), "")),
                     f'<span class="selo {e(x.get("gravidade") or "baixa")}">{e(x.get("gravidade") or "baixa")}</span>']
                    for x in lista]) if lista else ""
    if texto:
        corpo += f'<p class="texto">{e(texto)}</p>'
    return bloco("Ocorrências", corpo, len(lista) or None) if corpo else ""


def pendencias(lista: list[dict], titulo: str = "Pendências") -> str:
    if not lista:
        return ""
    linhas = []
    for x in lista:
        st = ('<span class="selo resolvida">resolvida</span>' if x.get("resolvida")
              else '<span class="selo aberta">em aberto</span>')
        linhas.append([e(x.get("descricao")), e(x.get("responsavel")), f_data(x.get("prazo")) if x.get("prazo") else "",
                       f_data(x.get("origem_data")) if x.get("origem_data") else "", st])
    return bloco(titulo, tabela(["Pendência", "Responsável", "Prazo", "Desde", "Situação"], linhas), len(lista))


def providencias(lista: list[dict]) -> str:
    if not lista:
        return ""
    return bloco("Providências", tabela(["Providência", "Responsável", "Prazo"],
                                        [[e(x.get("descricao")), e(x.get("responsavel")),
                                          f_data(x.get("prazo")) if x.get("prazo") else ""] for x in lista]), len(lista))


def observacoes(texto: str | None) -> str:
    return bloco("Observações", f'<p class="texto">{e(texto)}</p>') if texto else ""


def conteudo_diario(d: dict) -> str:
    """Todas as seções de um diário (exceto cabeçalho e fotos)."""
    return "".join([
        bloco("Condições climáticas", clima(d)),
        equipe(d.get("efetivo") or []),
        maquinas(d.get("equipamentos") or []),
        materiais(d.get("materiais") or [], d.get("materiais_recebidos")),
        servicos(d.get("atividades") or []),
        visitas(d.get("visitas_lista") or [], d.get("visitas")),
        ocorrencias(d.get("ocorrencias_lista") or [], d.get("ocorrencias")),
        pendencias(d.get("pendencias") or []),
        providencias(d.get("providencias") or []),
        observacoes(d.get("observacoes")),
    ])


def logo_html(m) -> str:
    return f'<img src="{m.logo}">' if m.logo else f"<span>{e(m.nome)}</span>"
