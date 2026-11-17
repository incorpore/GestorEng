"""Galeria de fotos para PDF em "linhas justificadas".

Cada linha tem altura única e as larguras proporcionais à proporção de cada foto, preenchendo a largura útil.
Assim fotos horizontais e verticais convivem sem distorção nem cortes: verticais tendem a ficar 3-4 por linha,
horizontais 2 por linha. Fotos isoladas muito altas são limitadas e centralizadas.
"""
import base64
from dataclasses import dataclass
from html import escape

from app.core import imagens
from app.core.imagens import data_abreviada, fuso


@dataclass
class Foto:
    uuid: str
    largura: int
    altura: int
    descricao: str | None = None
    capturado_em: object = None
    latitude: float | None = None
    longitude: float | None = None

    @property
    def proporcao(self) -> float:
        if self.largura and self.altura:
            return max(0.35, min(3.5, self.largura / self.altura))
        return 4 / 3


def linhas(fotos: list[Foto], largura: float, altura_alvo: float, altura_max: float, max_por_linha: int,
           espaco: float) -> list[tuple[list[Foto], float]]:
    """Agrupa as fotos em linhas: retorna [(fotos, altura_mm)]."""
    resultado, atual = [], []
    for f in fotos:
        atual.append(f)
        soma = sum(x.proporcao for x in atual)
        h = (largura - espaco * (len(atual) - 1)) / soma
        if h <= altura_alvo or len(atual) >= max_por_linha:
            resultado.append((atual, min(h, altura_max)))
            atual = []
    if atual:  # última linha: não estica além da altura alvo
        soma = sum(x.proporcao for x in atual)
        h = min((largura - espaco * (len(atual) - 1)) / soma, altura_alvo, altura_max)
        resultado.append((atual, h))
    return resultado


def _data_uri(uuid: str, lado: int) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(imagens.derivado(uuid, lado)).decode()


def html(fotos: list[Foto], *, largura: float, altura_alvo: float, altura_max: float, max_por_linha: int = 4,
         espaco: float = 2.5, resolucao: int = 1400, legendas: bool = True) -> str:
    if not fotos:
        return ""
    partes = []
    for grupo, h in linhas(fotos, largura, altura_alvo, altura_max, max_por_linha, espaco):
        itens = []
        for f in grupo:
            w = h * f.proporcao
            leg = ""
            if legendas:
                quando = ""
                if f.capturado_em:
                    dt = f.capturado_em.astimezone(fuso())
                    quando = f"{data_abreviada(dt)} · {dt:%H:%M}"
                texto = escape(f.descricao or "")
                coord = f"{f.latitude:.6f}, {f.longitude:.6f}" if f.latitude is not None and f.longitude is not None else ""
                leg = (f'<figcaption style="width:{w:.2f}mm">'
                       + (f"<b>{texto}</b>" if texto else "")
                       + (f"<span>{escape(quando)}</span>" if quando else "")
                       + (f"<span>{coord}</span>" if coord else "") + "</figcaption>")
            itens.append(f'<figure><img src="{_data_uri(f.uuid, resolucao)}" style="width:{w:.2f}mm;height:{h:.2f}mm">'
                         f"{leg}</figure>")
        partes.append(f'<div class="galeria-linha" style="gap:{espaco}mm">{"".join(itens)}</div>')
    return '<div class="galeria">' + "".join(partes) + "</div>"
