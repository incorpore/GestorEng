"""PDF do diário de obra e cartilha da obra (período), com a identidade visual da empresa."""
import io
from collections.abc import Callable
from datetime import date, datetime
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session
from weasyprint import CSS, HTML

from app.core import storage
from app.core.imagens import fuso
from app.core.models import Arquivo
from app.modules.documentos.pdf import _data_uri, _overlay, _safe_fetcher

from . import blocos, galeria, livreto
from .blocos import e
from .estilo import FORMATOS, Marca, carregar_marca, css

MESES_ABR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]


def _dump(d) -> dict:
    from ..schemas import DiarioOut

    return DiarioOut.model_validate(d).model_dump(mode="json")


def fotos_de(db: Session, entidade: str, ids: list[int]) -> dict[int, list[galeria.Foto]]:
    out: dict[int, list[galeria.Foto]] = {i: [] for i in ids}
    if not ids:
        return out
    q = (select(Arquivo).where(Arquivo.entidade == entidade, Arquivo.entidade_id.in_(ids),
                               Arquivo.mime.in_(["image/jpeg", "image/png", "image/webp"]))
         .order_by(Arquivo.capturado_em.asc().nulls_last(), Arquivo.id))
    for a in db.scalars(q):
        out[a.entidade_id].append(galeria.Foto(a.uuid, a.largura or 0, a.altura or 0, a.descricao, a.capturado_em,
                                               a.latitude, a.longitude))
    return out


def _timbrado(db: Session) -> tuple[dict | None, list[bytes]]:
    """Configuração do papel timbrado para relatórios (fundo em imagem via CSS ou PDF sobreposto)."""
    from app.modules.sistema.service import get_config

    cfg = get_config(db, "timbrado")
    pdfs: list[bytes] = []
    fundo = ""
    for campo in ("arquivo_id", "arquivo_continuacao_id"):
        a = db.get(Arquivo, cfg.get(campo) or 0)
        if not a:
            continue
        dados = storage.read_bytes(a.uuid)
        if a.mime == "application/pdf":
            pdfs.append(dados)
        elif campo == "arquivo_id":
            fundo = f"background: url('{_data_uri(dados, a.mime)}') no-repeat 0 0; background-size: 210mm 297mm;"
    return {**cfg, "fundo_css": fundo}, pdfs


def _render(html: str, estilo: str, fundos_pdf: list[bytes] | None = None, titulo: str = "Relatório") -> bytes:
    doc = (f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><title>{escape(titulo)}</title></head>"
           f"<body>{html}</body></html>")
    pdf = HTML(string=doc, url_fetcher=_safe_fetcher).write_pdf(stylesheets=[CSS(string=estilo, url_fetcher=_safe_fetcher)])
    return _overlay(pdf, fundos_pdf) if fundos_pdf else pdf


def _largura_util(formato: str, timbrado: dict | None) -> float:
    f = FORMATOS[formato]
    if timbrado:
        return f["w"] - float(timbrado["margem_esquerda"]) - float(timbrado["margem_direita"])
    return f["w"] - f["int"] - f["ext"]


def _galeria(fotos: list[galeria.Foto], formato: str, largura: float) -> str:
    if formato == "a5":
        return galeria.html(fotos, largura=largura, altura_alvo=40, altura_max=68, max_por_linha=3, resolucao=1000)
    return galeria.html(fotos, largura=largura, altura_alvo=58, altura_max=95, max_por_linha=4, resolucao=1400)


def _kpis(itens: list[tuple[str, str]]) -> str:
    return '<div class="kpis">' + "".join(f'<div class="kpi"><b>{e(v)}</b><span>{e(r)}</span></div>' for v, r in itens) + "</div>"


# ------------------------------------------------------------------------------------------------ diário
def pdf_diario(db: Session, d, timbrado: bool = False) -> bytes:
    m = carregar_marca(db)
    obra = d.obra
    dados = _dump(d)
    fotos = fotos_de(db, "diario", [d.id])[d.id]
    cfg, fundos = _timbrado(db) if timbrado else (None, [])
    largura = _largura_util("a4", cfg)
    chips = f'<span class="obra-nome">{e(obra.nome)}</span>' + "".join(
        f"<span>{e(x)}</span>" for x in (f"Contrato {obra.numero_contrato}" if obra.numero_contrato else None,
                                         f"RDO nº {d.numero:04d}") if x)
    local = ", ".join(x for x in (obra.endereco, obra.cidade and f"{obra.cidade}/{obra.uf or ''}") if x)
    cabecalho = f"""
<div class="cabecalho"><div class="topo"><div class="chips">{chips}</div>
<div class="logo">{blocos.logo_html(m)}</div></div>
<div class="dia-semana">{blocos.dia_semana(d.data)}</div>
<h1 class="secao-titulo">{d.data:%d/%m/%Y}</h1>
<div class="sub">Relatório Diário de Obra{f" · {e(local)}" if local else ""}{f" · Cliente: {e(obra.cliente_nome)}" if obra.cliente_nome else ""}</div></div>"""
    media = dados.get("media_servicos")
    kpis = _kpis([(str(dados["total_efetivo"]), "Equipe"), (f"{media:.0f}%" if media is not None else "—", "Serviços"),
                  (str(len(fotos)), "Fotos"), (str(dados["pendencias_abertas"]), "Pendências")])
    fotos_html = blocos.bloco("Registro fotográfico", _galeria(fotos, "a4", largura), len(fotos)) if fotos else ""
    assinaturas = (f'<div class="assinaturas"><div>{e(d.responsavel or "")}<small>Responsável pelo registro</small></div>'
                   f'<div>{e(obra.fiscal_contrato or "")}<small>Fiscalização</small></div></div>')
    html = cabecalho + kpis + blocos.conteudo_diario(dados) + fotos_html + assinaturas
    return _render(html, css(m, "a4", False, cfg), fundos, titulo=f"Diário {d.data:%d/%m/%Y} - {obra.nome}")


# ------------------------------------------------------------------------------------------------ cartilha
def _capa(m: Marca, obra, inicio: date, fim: date, titulo: str, foto: galeria.Foto | None, formato: str) -> str:
    img = ""
    if foto:
        img = f'<div class="foto"><img src="{galeria._data_uri(foto.uuid, 1400)}"></div>'
    local = ", ".join(x for x in (obra.cidade and f"{obra.cidade}/{obra.uf or ''}", obra.endereco) if x)
    rodape = "".join(f"<div>{x}</div>" for x in (
        f"<b>{e(obra.cliente_nome)}</b>" if obra.cliente_nome else "",
        f"Contrato {e(obra.numero_contrato)}" if obra.numero_contrato else "", e(local)) if x)
    return f"""<section class="capa"><div class="logo">{blocos.logo_html(m)}</div>
<div class="rotulo">{e(titulo)}</div><h1 class="obra-nome">{e(obra.nome)}</h1>
<div class="periodo">{blocos.data_longa(inicio)} a {blocos.data_longa(fim)}</div>{img}
<div class="rodape">{rodape}<div style="margin-top:2mm">{e(m.nome)}</div></div></section>"""


def _apresentacao(db: Session, obra, diarios: list[dict], fotos_total: int, formato: str) -> str:
    from app.modules.obras.models import ServicoObra

    linhas = [("Objeto", obra.objeto), ("Cliente", obra.cliente_nome), ("Contrato", obra.numero_contrato),
              ("Local", ", ".join(x for x in (obra.endereco, obra.cidade and f"{obra.cidade}/{obra.uf or ''}") if x)),
              ("Responsável técnico", " · ".join(x for x in (obra.responsavel_tecnico, obra.crea_cau) if x)),
              ("Fiscal do contrato", obra.fiscal_contrato),
              ("Prazo", f"{obra.data_inicio:%d/%m/%Y} a {obra.data_prevista_fim:%d/%m/%Y}"
               if obra.data_inicio and obra.data_prevista_fim else None)]
    ficha = "".join(f"<tr><td>{r}</td><td>{e(v)}</td></tr>" for r, v in linhas if v)
    efetivo = [x["total_efetivo"] for x in diarios]
    chuva = sum(1 for x in diarios if {x.get("clima_manha"), x.get("clima_tarde")} & {"chuvoso", "tempestade", "garoa"})
    imprat = sum(1 for x in diarios if x.get("condicao") == "impraticavel")
    kpis = _kpis([(str(len(diarios)), "Dias registrados"),
                  (f"{sum(efetivo) / len(efetivo):.1f}".replace(".", ",") if efetivo else "0", "Equipe média"),
                  (str(chuva), "Dias com chuva"), (str(fotos_total), "Fotos")])
    if formato == "a5":  # 4 indicadores lado a lado ficam apertados em A5: 2 linhas
        kpis = kpis.replace('<div class="kpis">', '<div class="kpis" style="flex-wrap:wrap">').replace(
            'class="kpi"', 'class="kpi" style="flex:1 1 40%"')
    servicos = db.scalars(select(ServicoObra).where(ServicoObra.obra_id == obra.id).order_by(ServicoObra.ordem, ServicoObra.inicio)).all()
    cron = ""
    if servicos:
        linhas_s = []
        for s in servicos:
            p = float(s.percentual or 0)
            cls = "ok" if p >= 100 else "atraso" if s.situacao == "atrasado" else ""
            linhas_s.append([f"{e(s.descricao)}<br><small>{s.inicio:%d/%m} a {s.fim:%d/%m/%Y}</small>",
                             f'<b>{p:.0f}%</b><div class="barra {cls}"><i style="width:{min(p, 100):.0f}%"></i></div>'])
        cron = blocos.bloco("Andamento dos serviços", blocos.tabela(["Serviço", "Avanço"], linhas_s, {1}))
    abertas = [p for p in (diarios[-1].get("pendencias") or []) if not p.get("resolvida")] if diarios else []
    nota = (f'<p class="nota">{imprat} dia(s) com condição impraticável no período.</p>' if imprat else "")
    return (f'<section class="quebra"><h2 class="titulo-pagina secao-titulo">Sobre a obra</h2>'
            f'<table class="ficha">{ficha}</table>{kpis}{nota}{cron}'
            f'{blocos.pendencias(abertas, "Pendências em aberto ao fim do período")}</section>')


def _sumario(diarios: list[dict]) -> str:
    itens = "".join(f'<a href="#d{x["id"]}"><span>{blocos.dia_semana(date.fromisoformat(x["data"]))}, '
                    f'{date.fromisoformat(x["data"]):%d/%m/%Y} — RDO nº {x["numero"]:04d}</span></a>' for x in diarios)
    return f'<section class="quebra sumario"><h2 class="titulo-pagina secao-titulo">Sumário</h2>{itens}</section>'


def _dia(x: dict, fotos: list[galeria.Foto], formato: str, largura: float) -> str:
    d = date.fromisoformat(x["data"])
    info = " · ".join(v for v in (f"RDO nº {x['numero']:04d}", f"Responsável: {e(x.get('responsavel'))}" if x.get("responsavel") else "",
                                  f"Equipe: {x['total_efetivo']}") if v)
    galeria_html = blocos.bloco("Registro fotográfico", _galeria(fotos, formato, largura), len(fotos)) if fotos else ""
    return (f'<section class="dia" id="d{x["id"]}"><div class="dia-cab"><div class="data"><b>{d.day:02d}</b>'
            f'<span>{MESES_ABR[d.month - 1]}</span></div><div><h2 class="secao-titulo">{blocos.dia_semana(d)}, '
            f'{blocos.data_longa(d)}</h2><div class="info">{info}</div></div></div>'
            f'{blocos.conteudo_diario(x)}{galeria_html}</section>')


def _encerramento(m: Marca, obra, emitido_por: str | None) -> str:
    agora = datetime.now(fuso())
    return (f'<section class="quebra"><h2 class="titulo-pagina secao-titulo">Encerramento</h2>'
            f'<p class="texto">Esta cartilha reúne os registros diários de obra, condições climáticas, equipes, serviços, '
            f'ocorrências e o registro fotográfico do período. As fotografias trazem marca d\'água com as coordenadas '
            f'e a data/hora de captura.</p>'
            f'<div class="assinaturas"><div>{e(obra.responsavel_tecnico or "")}<small>Responsável técnico '
            f'{e(obra.crea_cau or "")}</small></div><div>{e(obra.fiscal_contrato or "")}<small>Fiscalização</small></div></div>'
            f'<p class="nota" style="margin-top:10mm">Documento emitido em {agora:%d/%m/%Y às %H:%M}'
            f'{f" por {e(emitido_por)}" if emitido_por else ""} — {e(m.nome)}.</p></section>')


def _contracapa(m: Marca) -> str:
    linhas = "".join(f"<p>{e(x)}</p>" for x in (m.razao, f"CNPJ {m.cnpj}" if m.cnpj else "", m.contato) if x)
    return f'<section class="contracapa"><div><div class="logo">{blocos.logo_html(m)}</div>{linhas}</div></section>'


def pdf_cartilha(db: Session, obra, inicio: date, fim: date, *, formato: str = "livreto", fotos_por_dia: int | None = None,
                 titulo: str = "Cartilha da obra", emitido_por: str | None = None,
                 progresso: Callable[[str], None] | None = None) -> bytes:
    """formato: 'livreto' (A5 imposto em A4 para imprimir e dobrar), 'a5' (digital) ou 'a4'."""
    from ..models import DiarioObra

    tamanho = "a4" if formato == "a4" else "a5"
    m = carregar_marca(db)
    registros = db.scalars(select(DiarioObra).where(DiarioObra.obra_id == obra.id, DiarioObra.data >= inicio,
                                                    DiarioObra.data <= fim).order_by(DiarioObra.data)).all()
    diarios = [_dump(x) for x in registros]
    todas = fotos_de(db, "diario", [x["id"] for x in diarios])
    if fotos_por_dia is not None:
        todas = {k: v[:fotos_por_dia] for k, v in todas.items()}
    total_fotos = sum(len(v) for v in todas.values())
    capa_foto = next((f for x in diarios for f in todas[x["id"]] if f.largura > f.altura), None) or \
        next((f for x in diarios for f in todas[x["id"]]), None)
    largura = _largura_util(tamanho, None)
    if progresso:
        progresso(f"Montando {len(diarios)} diário(s) e {total_fotos} foto(s)")
    partes = [_capa(m, obra, inicio, fim, titulo, capa_foto, tamanho), _apresentacao(db, obra, diarios, total_fotos, tamanho)]
    if diarios:
        partes.append(_sumario(diarios))
        partes += [_dia(x, todas[x["id"]], tamanho, largura) for x in diarios]
    else:
        partes.append('<section class="quebra"><p class="vazio">Nenhum diário registrado no período.</p></section>')
    partes += [_encerramento(m, obra, emitido_por), _contracapa(m)]
    if progresso:
        progresso("Gerando PDF")
    pdf = _render("".join(partes), css(m, tamanho, formato == "livreto"), titulo=f"{titulo} - {obra.nome}")
    if formato == "livreto":
        pdf = livreto.impor(pdf)
    return pdf


def paginas(pdf: bytes) -> int:
    from pypdf import PdfReader

    return len(PdfReader(io.BytesIO(pdf)).pages)
