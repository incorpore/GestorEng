"""Processamento de fotos de obra.

- Corrige a orientação pela EXIF (fotos de celular em pé/deitadas);
- lê data/hora e GPS da EXIF; se não houver, usa a localização enviada pelo aparelho e, por último,
  as coordenadas cadastradas da obra;
- reduz para no máximo 2560 px no maior lado;
- grava a marca d'água: coordenadas + data abreviada e hora (ex.: "Seg 12 de set de 2026 · 14:32");
- gera versões reduzidas (com cache) para PDFs e miniaturas.
"""
import io
import os
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont, ImageOps

DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
MAX_LADO = 2560
FONTES = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"]
Image.MAX_IMAGE_PIXELS = 80_000_000  # proteção contra "bombas" de descompressão


def fuso() -> ZoneInfo:
    try:
        return ZoneInfo(os.environ.get("TZ") or "America/Sao_Paulo")
    except Exception:  # noqa: BLE001
        return ZoneInfo("America/Sao_Paulo")


def data_abreviada(dt: datetime) -> str:
    """Seg 12 de set de 2026"""
    return f"{DIAS[dt.weekday()]} {dt.day} de {MESES[dt.month - 1]} de {dt.year}"


def formatar_coord(lat: float, lon: float) -> str:
    return f"{lat:.6f}, {lon:.6f}"


@lru_cache(maxsize=16)
def _fonte(tamanho: int):
    for f in FONTES:
        if Path(f).exists():
            return ImageFont.truetype(f, tamanho)
    return ImageFont.load_default(size=tamanho)


def _racional(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError, ZeroDivisionError):
        return float(v[0]) / float(v[1])


def ler_exif(img: Image.Image) -> tuple[datetime | None, float | None, float | None]:
    """Retorna (data/hora local da captura, latitude, longitude) a partir da EXIF."""
    try:
        exif = img.getexif()
    except Exception:  # noqa: BLE001
        return None, None, None
    quando = None
    try:
        sub = exif.get_ifd(0x8769)
        bruto = sub.get(36867) or sub.get(36868) or exif.get(306)
        if bruto:
            quando = datetime.strptime(str(bruto).strip()[:19], "%Y:%m:%d %H:%M:%S").replace(tzinfo=fuso())
    except (ValueError, TypeError):
        quando = None
    lat = lon = None
    try:
        gps = exif.get_ifd(0x8825)
        if gps and 2 in gps and 4 in gps:
            def graus(v):
                d, m, s = (_racional(x) for x in v)
                return d + m / 60 + s / 3600

            lat, lon = graus(gps[2]), graus(gps[4])
            if str(gps.get(1, "N")).upper().startswith("S"):
                lat = -lat
            if str(gps.get(3, "E")).upper().startswith("W"):
                lon = -lon
            if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
                lat = lon = None
    except Exception:  # noqa: BLE001
        lat = lon = None
    return quando, lat, lon


@dataclass
class FotoProcessada:
    jpeg: bytes
    largura: int
    altura: int
    capturado_em: datetime
    latitude: float | None
    longitude: float | None
    coord_fonte: str | None  # exif | dispositivo | obra


def marca_dagua(img: Image.Image, linhas: list[str]) -> Image.Image:
    """Faixa semitransparente no canto inferior esquerdo com as linhas de texto."""
    w, h = img.size
    tam = max(16, int(min(w, h) * 0.038))
    fonte = _fonte(tam)
    pad = int(tam * 0.6)
    gap = int(tam * 0.35)
    draw_tmp = ImageDraw.Draw(img)
    medidas = [draw_tmp.textbbox((0, 0), t, font=fonte) for t in linhas]
    larg = max(b[2] - b[0] for b in medidas) + pad * 2
    alt = sum(b[3] - b[1] for b in medidas) + gap * (len(linhas) - 1) + pad * 2
    margem = int(min(w, h) * 0.025)
    x0, y0 = margem, h - margem - alt
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    d.rounded_rectangle((x0, y0, x0 + larg, y0 + alt), radius=int(tam * 0.5), fill=(0, 0, 0, 150))
    y = y0 + pad
    for t, b in zip(linhas, medidas, strict=True):
        d.text((x0 + pad, y - b[1]), t, font=fonte, fill=(255, 255, 255, 240))
        y += (b[3] - b[1]) + gap
    return Image.alpha_composite(img.convert("RGBA"), camada).convert("RGB")


def processar_foto(dados: bytes, *, latitude: float | None = None, longitude: float | None = None,
                   quando: datetime | None = None, coords_obra: tuple[float, float] | None = None,
                   titulo: str | None = None) -> FotoProcessada:
    img = Image.open(io.BytesIO(dados))
    exif_quando, exif_lat, exif_lon = ler_exif(img)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    img.thumbnail((MAX_LADO, MAX_LADO), Image.Resampling.LANCZOS)

    if exif_lat is not None:
        lat, lon, fonte = exif_lat, exif_lon, "exif"
    elif latitude is not None and longitude is not None:
        lat, lon, fonte = latitude, longitude, "dispositivo"
    elif coords_obra:
        lat, lon, fonte = coords_obra[0], coords_obra[1], "obra"
    else:
        lat = lon = fonte = None
    momento = (exif_quando or quando or datetime.now(fuso())).astimezone(fuso())

    linhas = []
    if titulo:
        linhas.append(titulo[:60])
    if lat is not None:
        linhas.append(formatar_coord(lat, lon) + (" (obra)" if fonte == "obra" else ""))
    linhas.append(f"{data_abreviada(momento)} · {momento:%H:%M}")
    img = marca_dagua(img, linhas)

    out = io.BytesIO()
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    return FotoProcessada(out.getvalue(), img.width, img.height, momento, lat, lon, fonte)


def reduzida(dados: bytes, max_lado: int, qualidade: int = 80) -> bytes:
    img = Image.open(io.BytesIO(dados))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((max_lado, max_lado), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "JPEG", quality=qualidade, optimize=True, progressive=True)
    return out.getvalue()


def derivado(file_uuid: str, max_lado: int) -> bytes:
    """Versão reduzida com cache em disco (storage/derivados)."""
    from . import storage

    destino = storage.root() / "derivados" / f"{file_uuid}_{max_lado}.jpg"
    if destino.exists():
        return destino.read_bytes()
    dados = reduzida(storage.read_bytes(file_uuid), max_lado)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(dados)
    return dados


def dimensoes(dados: bytes) -> tuple[int, int]:
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(dados)))
    return img.size
