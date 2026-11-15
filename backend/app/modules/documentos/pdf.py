"""Geração de PDF com papel timbrado e margens configuráveis (WeasyPrint + pypdf)."""
import base64
import io
import logging

from pypdf import PdfReader, PdfWriter, Transformation
from weasyprint import CSS, HTML
from weasyprint.urls import URLFetchingError

log = logging.getLogger(__name__)

A4 = (210, 297)


def _safe_fetcher(url: str, timeout=10, ssl_context=None):
    """Bloqueia qualquer acesso externo (SSRF/arquivos locais): só aceita data: URIs."""
    if url.startswith("data:"):
        header, _, payload = url.partition(",")
        mime = header[5:].split(";")[0] or "application/octet-stream"
        raw = base64.b64decode(payload) if ";base64" in header else payload.encode()
        return {"string": raw, "mime_type": mime}
    raise URLFetchingError("Recurso externo bloqueado")


def _page_css(*, margens: dict, orientacao: str, fonte: str, tamanho: float, entrelinha: float,
              fundo_primeira: str | None, fundo_demais: str | None, numerar: bool, texto_numeracao: str) -> str:
    size = "A4 landscape" if orientacao == "paisagem" else "A4"
    w, h = (A4[1], A4[0]) if orientacao == "paisagem" else A4
    m = {k: float(margens.get(k, 20)) for k in ("margem_superior", "margem_direita", "margem_inferior", "margem_esquerda")}
    num = ""
    if numerar:
        partes = texto_numeracao.replace('"', "'").split("{pagina}")
        antes = partes[0]
        depois = partes[1] if len(partes) > 1 else ""
        d1, _, d2 = depois.partition("{total}")
        content = f'"{antes}" counter(page) "{d1}"' + (f' counter(pages) "{d2}"' if "{total}" in depois else "")
        num = f"@bottom-right {{ content: {content}; font-size: 8pt; color: #555; }}"

    def bg(uri):
        return f"background: url('{uri}') no-repeat 0 0; background-size: {w}mm {h}mm;" if uri else ""

    css = f"""
    @page {{ size: {size}; margin: {m['margem_superior']}mm {m['margem_direita']}mm {m['margem_inferior']}mm {m['margem_esquerda']}mm;
             {bg(fundo_demais or fundo_primeira)} {num} }}
    @page :first {{ {bg(fundo_primeira)} }}
    html {{ font-family: {fonte}; font-size: {tamanho}pt; line-height: {entrelinha}; color: #111; }}
    body {{ margin: 0; }}
    p {{ margin: 0 0 0.6em 0; text-align: justify; }}
    h1 {{ font-size: 1.5em; margin: 0 0 .5em; }} h2 {{ font-size: 1.25em; margin: .8em 0 .4em; }}
    h3 {{ font-size: 1.1em; margin: .6em 0 .3em; }}
    table {{ width: 100%; border-collapse: collapse; margin: .5em 0; page-break-inside: auto; font-size: .92em; }}
    tr {{ page-break-inside: avoid; }}
    thead {{ display: table-header-group; }}
    th, td {{ border: 1px solid #999; padding: 3px 5px; vertical-align: top; }}
    th {{ background: #eef1f5; }}
    td p, th p {{ margin: 0; text-align: left; }}
    img {{ max-width: 100%; }}
    .quebra-pagina, .page-break {{ page-break-after: always; }}
    .assinatura {{ margin-top: 3em; text-align: center; }}
    .assinatura .linha {{ border-top: 1px solid #000; width: 60%; margin: 0 auto; padding-top: 4px; }}
    .direita {{ text-align: right; }} .centro {{ text-align: center; }} .num {{ text-align: right; white-space: nowrap; }}
    [style*="text-align: center"] {{ text-align: center; }} [style*="text-align: right"] {{ text-align: right; }}
    """
    return css


def _data_uri(data: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def html_to_pdf(body_html: str, *, config: dict, usar_timbrado: bool, orientacao: str = "retrato",
                margens: dict | None = None, css_extra: str | None = None,
                timbrado: tuple[bytes, str] | None = None, timbrado_cont: tuple[bytes, str] | None = None,
                titulo: str = "Documento") -> bytes:
    margens = {**{k: config.get(k) for k in ("margem_superior", "margem_direita", "margem_inferior", "margem_esquerda")},
               **(margens or {})}
    img1 = img2 = None
    pdf_bg: list[bytes] = []
    if usar_timbrado and timbrado:
        for item, slot in ((timbrado, 1), (timbrado_cont, 2)):
            if not item:
                continue
            data, mime = item
            if mime == "application/pdf":
                pdf_bg.append(data)
            elif slot == 1:
                img1 = _data_uri(data, mime)
            else:
                img2 = _data_uri(data, mime)
    css = _page_css(margens=margens, orientacao=orientacao, fonte=config.get("fonte") or "Arial, sans-serif",
                    tamanho=float(config.get("tamanho_fonte") or 11), entrelinha=float(config.get("entrelinha") or 1.4),
                    fundo_primeira=img1, fundo_demais=img2, numerar=bool(config.get("numerar_paginas")),
                    texto_numeracao=config.get("texto_numeracao") or "Página {pagina} de {total}")
    from html import escape

    doc = f"<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><title>{escape(titulo)}</title></head><body>{body_html}</body></html>"
    stylesheets = [CSS(string=css, url_fetcher=_safe_fetcher)]
    if css_extra:
        stylesheets.append(CSS(string=css_extra, url_fetcher=_safe_fetcher))
    pdf = HTML(string=doc, url_fetcher=_safe_fetcher).write_pdf(stylesheets=stylesheets)
    if pdf_bg:
        pdf = _overlay(pdf, pdf_bg)
    return pdf


def _overlay(content_pdf: bytes, backgrounds: list[bytes]) -> bytes:
    """Coloca cada página do conteúdo sobre o timbrado em PDF (1ª página e páginas seguintes)."""
    content = PdfReader(io.BytesIO(content_pdf))
    bg_first = PdfReader(io.BytesIO(backgrounds[0])).pages[0]
    bg_next_reader = PdfReader(io.BytesIO(backgrounds[1] if len(backgrounds) > 1 else backgrounds[0]))
    bg_next = bg_next_reader.pages[1] if len(backgrounds) == 1 and len(bg_next_reader.pages) > 1 else bg_next_reader.pages[0]
    writer = PdfWriter()
    for idx, page in enumerate(content.pages):
        bg = bg_first if idx == 0 else bg_next
        w, h = float(page.mediabox.width), float(page.mediabox.height)
        new = writer.add_blank_page(width=w, height=h)
        bw, bh = float(bg.mediabox.width), float(bg.mediabox.height)
        new.merge_transformed_page(bg, Transformation().scale(w / bw, h / bh))
        new.merge_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
