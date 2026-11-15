"""Funções utilizáveis nos modelos: {{ tabela_medicao(medicao) }}, {{ assinatura(...) }} etc.

Geram HTML seguro (todos os valores são escapados) e permitem montar documentos complexos
sem laços {% for %} — mantendo os modelos editáveis no editor visual.
"""
from markupsafe import Markup, escape

from .render import f_data, f_moeda, f_numero


def _cell(v, cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return f"<td{c}>{escape(v if v is not None else '')}</td>"


def tabela_medicao(m: dict | None = None) -> Markup:
    """Tabela completa do boletim de medição: tabela_medicao(medicao)"""
    if not m:
        return Markup("")
    head = ("<thead><tr><th>Item</th><th>Descrição</th><th>Un.</th><th>Qtd. contratada</th><th>Preço unit.</th>"
            "<th>Qtd. anterior</th><th>Qtd. período</th><th>Qtd. acumulada</th><th>Valor período</th>"
            "<th>Valor acumulado</th><th>%</th></tr></thead>")
    rows = []
    for i in m.get("itens") or []:
        rows.append("<tr>" + _cell(i.get("codigo")) + _cell(i.get("descricao")) + _cell(i.get("unidade"))
                    + _cell(f_numero(i.get("qtd_contratada"), 2), "num") + _cell(f_moeda(i.get("preco_unitario")), "num")
                    + _cell(f_numero(i.get("qtd_anterior"), 2), "num") + _cell(f_numero(i.get("qtd_periodo"), 2), "num")
                    + _cell(f_numero(i.get("qtd_acumulada"), 2), "num") + _cell(f_moeda(i.get("valor_periodo")), "num")
                    + _cell(f_moeda(i.get("valor_acumulado")), "num") + _cell(f_numero(i.get("percentual"), 2), "num")
                    + "</tr>")
    foot = (f"<tr><th colspan='8' class='direita'>TOTAIS</th><th class='num'>{escape(f_moeda(m.get('valor_periodo')))}</th>"
            f"<th class='num'>{escape(f_moeda(m.get('valor_acumulado')))}</th><th></th></tr>")
    return Markup(f"<table style='font-size:8pt'>{head}<tbody>{''.join(rows)}{foot}</tbody></table>")  # noqa: S704


def tabela_orcamento(o: dict | None = None, mostrar_bdi: bool = True) -> Markup:
    """Planilha orçamentária com etapas, subtotais, BDI e total: tabela_orcamento(orcamento)"""
    if not o:
        return Markup("")
    head = ("<thead><tr><th>Item</th><th>Fonte</th><th>Código</th><th>Descrição</th><th>Un.</th><th>Qtd.</th>"
            "<th>Preço unit.</th><th>Total</th></tr></thead>")
    rows = []
    for i in o.get("itens") or []:
        if i.get("agrupador"):
            rows.append(f"<tr style='background:#f3f4f6'><th>{escape(i.get('item') or '')}</th>"
                        f"<th colspan='7' style='text-align:left'>{escape(i.get('descricao') or '')}</th></tr>")
            continue
        rows.append("<tr>" + _cell(i.get("item")) + _cell(i.get("fonte")) + _cell(i.get("codigo"))
                    + _cell(i.get("descricao")) + _cell(i.get("unidade")) + _cell(f_numero(i.get("quantidade"), 2), "num")
                    + _cell(f_moeda(i.get("preco_unitario")), "num") + _cell(f_moeda(i.get("total")), "num") + "</tr>")
    tot = [f"<tr><th colspan='7' class='direita'>Custo direto</th><th class='num'>{escape(f_moeda(o.get('custo_direto')))}</th></tr>"]
    if mostrar_bdi:
        tot.append(f"<tr><th colspan='7' class='direita'>BDI ({escape(f_numero(o.get('bdi'), 2))}%)</th>"
                   f"<th class='num'>{escape(f_moeda(o.get('valor_bdi')))}</th></tr>")
    if o.get("valor_desconto"):
        tot.append(f"<tr><th colspan='7' class='direita'>Desconto ({escape(f_numero(o.get('desconto'), 2))}%)</th>"
                   f"<th class='num'>-{escape(f_moeda(o.get('valor_desconto')))}</th></tr>")
    tot.append(f"<tr><th colspan='7' class='direita'>TOTAL GERAL</th><th class='num'>{escape(f_moeda(o.get('total')))}</th></tr>")
    return Markup(f"<table style='font-size:8.5pt'>{head}<tbody>{''.join(rows)}{''.join(tot)}</tbody></table>")  # noqa: S704


def tabela_diario(d: dict | None = None) -> Markup:
    """Quadros do diário de obra (clima, efetivo, equipamentos, atividades): tabela_diario(diario)"""
    if not d:
        return Markup("")
    clima = {"bom": "Bom", "nublado": "Nublado", "chuvoso": "Chuvoso", "impraticavel": "Impraticável", None: "-"}
    parts = [
        "<table><tr><th>Data</th><th>Manhã</th><th>Tarde</th><th>Noite</th><th>Condição</th></tr><tr>"
        + _cell(f_data(d.get("data"))) + _cell(clima.get(d.get("clima_manha"), d.get("clima_manha")))
        + _cell(clima.get(d.get("clima_tarde"), d.get("clima_tarde"))) + _cell(clima.get(d.get("clima_noite"), "-"))
        + _cell((d.get("condicao") or "").replace("_", " ")) + "</tr></table>"
    ]
    if d.get("efetivo"):
        parts.append("<h3>Efetivo</h3><table><tr><th>Função</th><th>Empresa</th><th>Qtd.</th></tr>"
                     + "".join("<tr>" + _cell(e.get("funcao")) + _cell(e.get("empresa")) + _cell(e.get("quantidade"), "num")
                               + "</tr>" for e in d["efetivo"])
                     + f"<tr><th colspan='2' class='direita'>Total</th><th class='num'>{escape(d.get('total_efetivo') or 0)}</th></tr></table>")
    if d.get("equipamentos"):
        parts.append("<h3>Equipamentos</h3><table><tr><th>Descrição</th><th>Qtd.</th><th>Horas</th></tr>"
                     + "".join("<tr>" + _cell(e.get("descricao")) + _cell(e.get("quantidade"), "num")
                               + _cell(e.get("horas"), "num") + "</tr>" for e in d["equipamentos"]) + "</table>")
    if d.get("atividades"):
        parts.append("<h3>Atividades</h3><table><tr><th>Descrição</th><th>Local</th><th>Situação</th><th>%</th></tr>"
                     + "".join("<tr>" + _cell(a.get("descricao")) + _cell(a.get("local"))
                               + _cell((a.get("situacao") or "").replace("_", " ")) + _cell(a.get("percentual"), "num")
                               + "</tr>" for a in d["atividades"]) + "</table>")
    for campo, titulo in (("materiais_recebidos", "Materiais recebidos"), ("ocorrencias", "Ocorrências"),
                          ("visitas", "Visitas"), ("observacoes", "Observações")):
        if d.get(campo):
            parts.append(f"<h3>{titulo}</h3><p>{escape(d[campo]).replace(chr(10), Markup('<br>'))}</p>")
    return Markup("".join(parts))  # noqa: S704


def assinatura(nome: str = "", cargo: str = "", complemento: str = "") -> Markup:
    """Bloco de assinatura centralizado: assinatura(nome, cargo, complemento)"""
    linhas = "<br>".join(str(escape(x)) for x in (nome, cargo, complemento) if x)
    return Markup(f"<div class='assinatura'><div class='linha'>{linhas}</div></div>")  # noqa: S704


def quebra_pagina() -> Markup:
    """Força uma nova página: quebra_pagina()"""
    return Markup("<div class='quebra-pagina'></div>")


HELPERS = {"tabela_medicao": tabela_medicao, "tabela_orcamento": tabela_orcamento, "tabela_diario": tabela_diario,
           "assinatura": assinatura, "quebra_pagina": quebra_pagina}
