"""Identidade visual (cores e logo da empresa) e folhas de estilo dos relatórios."""
import base64
from dataclasses import dataclass

from sqlalchemy.orm import Session

FONTES = '"Liberation Sans", "DejaVu Sans", Arial, Helvetica, sans-serif'

# dimensões úteis (mm) por formato: (largura da página, altura, margem interna/externa, topo, base)
FORMATOS = {
    "a4": {"size": "A4", "w": 210, "h": 297, "int": 16, "ext": 14, "top": 20, "bot": 18},
    "a5": {"size": "A5", "w": 148, "h": 210, "int": 15, "ext": 11, "top": 16, "bot": 15},
}


@dataclass
class Marca:
    nome: str
    razao: str
    cnpj: str
    contato: str
    cor: str
    escura: str
    clara: str
    suave: str
    logo: str | None

    @property
    def iniciais(self) -> str:
        return "".join(p[0] for p in self.nome.split()[:2]).upper() or "S"


def _rgb(hexa: str) -> tuple[int, int, int]:
    h = (hexa or "#1d4ed8").lstrip("#")
    if len(h) != 6:
        h = "1d4ed8"
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _mistura(rgb, alvo, f) -> str:
    return "#" + "".join(f"{round(c + (t - c) * f):02x}" for c, t in zip(rgb, alvo, strict=True))


def carregar_marca(db: Session) -> Marca:
    from app.core import storage
    from app.core.models import Arquivo
    from app.modules.sistema.service import get_config

    e = get_config(db, "empresa")
    rgb = _rgb(e.get("cor_primaria") or "#1d4ed8")
    logo = None
    a = db.get(Arquivo, e.get("logo_arquivo_id") or 0)
    if a:
        logo = f"data:{a.mime};base64,{base64.b64encode(storage.read_bytes(a.uuid)).decode()}"
    contato = " · ".join(x for x in (e.get("telefone"), e.get("email"), e.get("site")) if x)
    return Marca(nome=e.get("nome_fantasia") or e.get("razao_social") or "Struvia", razao=e.get("razao_social") or "",
                 cnpj=e.get("cnpj") or "", contato=contato, cor="#{:02x}{:02x}{:02x}".format(*rgb),
                 escura=_mistura(rgb, (0, 0, 0), 0.35), clara=_mistura(rgb, (255, 255, 255), 0.82),
                 suave=_mistura(rgb, (255, 255, 255), 0.93), logo=logo)


def css(m: Marca, formato: str, livreto: bool, timbrado: dict | None = None) -> str:
    f = FORMATOS[formato]
    if timbrado:  # papel timbrado: margens e fundo vêm da configuração
        margens = (f"{timbrado['margem_superior']}mm {timbrado['margem_direita']}mm "
                   f"{timbrado['margem_inferior']}mm {timbrado['margem_esquerda']}mm")
        lados = ""
        fundo = timbrado.get("fundo_css", "")
    else:
        margens = f"{f['top']}mm {f['ext']}mm {f['bot']}mm {f['int']}mm"
        lados = (f"@page :left {{ margin-left: {f['ext']}mm; margin-right: {f['int']}mm; }}"
                 f"@page :right {{ margin-left: {f['int']}mm; margin-right: {f['ext']}mm; }}") if livreto else ""
        fundo = ""
    base = 9 if formato == "a5" else 9.5
    return f"""
@page {{
  size: {f['size']}; margin: {margens}; {fundo}
  @top-left {{ content: string(obra); font: 7pt {FONTES}; color: {m.escura}; vertical-align: bottom; padding-bottom: 2mm; }}
  @top-right {{ content: string(secao); font: 7pt {FONTES}; color: #6b7280; vertical-align: bottom; padding-bottom: 2mm; }}
  @bottom-left {{ content: "{m.nome}"; font: 6.5pt {FONTES}; color: #9ca3af; }}
  @bottom-right {{ content: "Página " counter(page) " de " counter(pages); font: 6.5pt {FONTES}; color: #6b7280; }}
}}
{lados}
@page capa {{ margin: 0; background: {m.cor};
  @top-left {{ content: none; }} @top-right {{ content: none; }} @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}
@page contracapa {{ margin: 0; background: {m.escura};
  @top-left {{ content: none; }} @top-right {{ content: none; }} @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}
@page :blank {{ @top-left {{ content: none; }} @top-right {{ content: none; }} @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}

html {{ font-family: {FONTES}; font-size: {base}pt; color: #1f2937; line-height: 1.38; }}
body {{ margin: 0; }}
h1, h2, h3 {{ color: {m.escura}; margin: 0; line-height: 1.15; }}
.obra-nome {{ string-set: obra content(); }}
.secao-titulo {{ string-set: secao content(); }}
.quebra {{ break-before: page; }}
.sem-quebra {{ break-inside: avoid; }}

/* cabeçalho do relatório */
.cabecalho {{ background: {m.escura}; color: #fff; border-radius: 3.5mm; padding: 5mm 6mm; margin-bottom: 4mm; }}
.cabecalho .topo {{ display: flex; justify-content: space-between; align-items: center; gap: 4mm; }}
.cabecalho .logo {{ background: #fff; border-radius: 2mm; padding: 1.5mm 2.5mm; height: 11mm; display: flex; align-items: center; }}
.cabecalho .logo img {{ max-height: 9mm; max-width: 40mm; }}
.cabecalho .logo span {{ color: {m.escura}; font-weight: bold; font-size: 11pt; }}
.chips span {{ display: inline-block; font-size: 6.8pt; font-weight: bold; letter-spacing: .4pt; text-transform: uppercase;
  background: rgba(255,255,255,.14); border-radius: 10mm; padding: 1mm 2.6mm; margin: 0 1mm 1mm 0; }}
.cabecalho .dia-semana {{ font-size: 7.5pt; letter-spacing: 1pt; text-transform: uppercase; opacity: .75; margin-top: 3mm; }}
.cabecalho h1 {{ color: #fff; font-size: 21pt; margin-top: .8mm; }}
.cabecalho .sub {{ opacity: .85; font-size: 8.5pt; margin-top: 1.2mm; }}

/* indicadores */
.kpis {{ display: flex; gap: 2.5mm; margin: 0 0 4mm; }}
.kpi {{ flex: 1; background: {m.suave}; border: .3mm solid {m.clara}; border-radius: 2.5mm; padding: 2.6mm 3mm; }}
.kpi b {{ display: block; font-size: 15pt; color: {m.escura}; }}
.kpi span {{ font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: .4pt; }}

/* blocos */
.bloco {{ margin: 0 0 4mm; }}
.bloco h3 {{ break-after: avoid; }}
.bloco .clima, .bloco p, thead {{ break-inside: avoid; }}
.bloco h3 {{ font-size: 10.5pt; display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm;
  border-bottom: .5mm solid {m.clara}; padding-bottom: 1.2mm; }}
.bloco h3 .qtd {{ font-size: 7pt; color: #6b7280; background: #f3f4f6; border-radius: 10mm; padding: .5mm 2mm; font-weight: normal; }}
.marcador {{ width: 2.2mm; height: 4.2mm; border-radius: 1mm; background: {m.cor}; display: inline-block; }}
table {{ width: 100%; border-collapse: collapse; font-size: .92em; }}
th {{ text-align: left; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .4pt; color: #6b7280; font-weight: bold;
  padding: 1.3mm 2mm; border-bottom: .3mm solid #e5e7eb; }}
td {{ padding: 1.5mm 2mm; border-bottom: .2mm solid #f1f5f9; vertical-align: top; }}
tr {{ break-inside: avoid; }}
.num {{ text-align: right; white-space: nowrap; }}
.vazio {{ color: #9ca3af; font-style: italic; font-size: .9em; }}
.texto {{ white-space: pre-line; text-align: justify; }}

/* clima */
.clima {{ display: flex; gap: 2.5mm; }}
.clima .periodo {{ flex: 1; border: .3mm solid #e5e7eb; border-radius: 2.5mm; padding: 2.5mm 3mm; }}
.clima .periodo .rot {{ font-size: 6.5pt; letter-spacing: .6pt; text-transform: uppercase; color: #9ca3af; font-weight: bold; }}
.clima .cond {{ display: flex; align-items: center; gap: 2mm; font-weight: bold; font-size: 10.5pt; margin: 1mm 0; }}
.clima .cond svg {{ width: 7mm; height: 7mm; }}
.pill {{ display: inline-block; font-size: 7pt; border: .25mm solid #e5e7eb; border-radius: 10mm; padding: .5mm 2mm; margin: .6mm .8mm 0 0; color: #374151; }}
.trabalho {{ font-size: 7.5pt; margin-top: 1.5mm; }}

/* progresso */
.barra {{ height: 2.2mm; background: #e5e7eb; border-radius: 2mm; overflow: hidden; margin-top: .8mm; }}
.barra i {{ display: block; height: 100%; background: {m.cor}; border-radius: 2mm; }}
.barra.ok i {{ background: #16a34a; }} .barra.atraso i {{ background: #dc2626; }}

/* selos */
.selo {{ display: inline-block; font-size: 6.5pt; font-weight: bold; border-radius: 10mm; padding: .4mm 2mm; text-transform: uppercase; }}
.selo.aberta {{ background: #fef3c7; color: #92400e; }} .selo.resolvida {{ background: #dcfce7; color: #166534; }}
.selo.alta {{ background: #fee2e2; color: #991b1b; }} .selo.media {{ background: #fef3c7; color: #92400e; }}
.selo.baixa {{ background: #e5e7eb; color: #374151; }}

/* fotos */
.galeria-linha {{ display: flex; justify-content: center; margin-bottom: 2.5mm; break-inside: avoid; }}
.galeria figure {{ margin: 0; }}
.galeria img {{ display: block; border-radius: 1.5mm; object-fit: cover; background: #f3f4f6; }}
.galeria figcaption {{ font-size: 6.4pt; color: #4b5563; padding-top: .8mm; line-height: 1.25; }}
.galeria figcaption b {{ display: block; color: #111827; font-weight: bold; }}
.galeria figcaption span {{ color: #6b7280; display: block; }}

/* assinaturas */
.assinaturas {{ display: flex; gap: 10mm; margin-top: 14mm; break-inside: avoid; }}
.assinaturas div {{ flex: 1; text-align: center; border-top: .3mm solid #374151; padding-top: 1.5mm; font-size: 8pt; }}
.assinaturas small {{ display: block; color: #6b7280; }}

/* cartilha */
.capa {{ page: capa; color: #fff; height: {f['h']}mm; box-sizing: border-box; padding: {f['top'] + 6}mm {f['int'] + 2}mm;
  display: flex; flex-direction: column; }}
.capa .logo {{ background: #fff; border-radius: 3mm; padding: 2.5mm 4mm; align-self: flex-start; }}
.capa .logo img {{ max-height: 14mm; max-width: 55mm; display: block; }}
.capa .logo span {{ color: {m.escura}; font-weight: bold; font-size: 14pt; }}
.capa .rotulo {{ margin-top: {14 if formato == 'a5' else 24}mm; font-size: 8pt; letter-spacing: 2.5pt; text-transform: uppercase; opacity: .85; }}
.capa h1 {{ color: #fff; font-size: {22 if formato == 'a5' else 32}pt; margin-top: 3mm; }}
.capa .periodo {{ margin-top: 4mm; font-size: 11pt; font-weight: bold; }}
.capa .foto {{ margin-top: 8mm; border-radius: 3mm; overflow: hidden; border: 1mm solid rgba(255,255,255,.35); }}
.capa .foto img {{ display: block; width: 100%; height: {58 if formato == 'a5' else 95}mm; object-fit: cover; }}
.capa .rodape {{ margin-top: auto; font-size: 8pt; opacity: .9; border-top: .3mm solid rgba(255,255,255,.35); padding-top: 3mm; }}
.capa .rodape b {{ display: block; font-size: 9pt; }}
.contracapa {{ page: contracapa; color: #fff; height: {f['h']}mm; box-sizing: border-box; padding: 0 {f['int'] + 4}mm;
  display: flex; flex-direction: column; justify-content: center; text-align: center; break-before: page; }}
.contracapa .logo {{ background: #fff; border-radius: 3mm; padding: 3mm 5mm; display: inline-block; margin: 0 auto 6mm; }}
.contracapa .logo img {{ max-height: 14mm; max-width: 55mm; display: block; }}
.contracapa .logo span {{ color: {m.escura}; font-weight: bold; font-size: 14pt; }}
.contracapa p {{ margin: 1mm 0; font-size: 8.5pt; opacity: .9; }}
.titulo-pagina {{ font-size: {14 if formato == 'a5' else 18}pt; margin-bottom: 4mm; padding-left: 3mm; border-left: 1.6mm solid {m.cor}; }}
.ficha {{ width: 100%; margin-bottom: 4mm; }}
.ficha td {{ border: none; padding: 1.2mm 0; }}
.ficha td:first-child {{ width: 32%; color: #6b7280; font-size: 7pt; text-transform: uppercase; letter-spacing: .4pt; }}
.sumario a {{ display: flex; color: #1f2937; text-decoration: none; padding: 1.4mm 0; border-bottom: .2mm dotted #d1d5db; }}
.sumario a span {{ flex: 1; }}
.sumario a::after {{ content: target-counter(attr(href), page); color: {m.escura}; font-weight: bold; }}
.dia {{ break-before: page; }}
.dia-cab {{ display: flex; align-items: stretch; gap: 3mm; margin-bottom: 3.5mm; }}
.dia-cab .data {{ background: {m.cor}; color: #fff; border-radius: 2.5mm; padding: 2mm 3mm; text-align: center; min-width: 14mm; }}
.dia-cab .data b {{ display: block; font-size: 16pt; line-height: 1; }}
.dia-cab .data span {{ font-size: 6.5pt; text-transform: uppercase; letter-spacing: .6pt; }}
.dia-cab h2 {{ font-size: {12 if formato == 'a5' else 15}pt; }}
.dia-cab .info {{ font-size: 7.5pt; color: #6b7280; margin-top: .8mm; }}
.nota {{ font-size: 7pt; color: #6b7280; background: #f9fafb; border-radius: 2mm; padding: 2mm 3mm; }}
"""
