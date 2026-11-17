"""Imposição de livreto (cartilha): páginas A5 montadas 2 por folha A4 paisagem na ordem de grampeamento.

Imprima frente e verso virando na BORDA CURTA, dobre o maço ao meio e grampeie na dobra.
"""
import io

from pypdf import PdfReader, PdfWriter, Transformation

A4_PAISAGEM = (841.89, 595.28)


def completar_multiplo_de_4(pdf: bytes, manter_ultima: bool = True) -> bytes:
    """Insere páginas em branco (antes da contracapa) até o total ser múltiplo de 4."""
    r = PdfReader(io.BytesIO(pdf))
    w = PdfWriter(clone_from=r)
    n = len(w.pages)
    faltam = (-n) % 4
    if faltam:
        largura, altura = float(w.pages[0].mediabox.width), float(w.pages[0].mediabox.height)
        pos = n - 1 if manter_ultima and n > 1 else n
        for _ in range(faltam):
            w.insert_blank_page(width=largura, height=altura, index=pos)
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


def ordem(n: int) -> list[tuple[int, int]]:
    """Pares (esquerda, direita) de cada face, na sequência frente/verso. n múltiplo de 4."""
    faces = []
    for i in range(n // 4):
        faces.append((n - 1 - 2 * i, 2 * i))          # frente
        faces.append((2 * i + 1, n - 2 - 2 * i))      # verso
    return faces


def impor(pdf_a5: bytes) -> bytes:
    src = PdfReader(io.BytesIO(completar_multiplo_de_4(pdf_a5)))
    paginas = src.pages
    w = PdfWriter()
    largura, altura = A4_PAISAGEM
    for esq, dir_ in ordem(len(paginas)):
        folha = w.add_blank_page(width=largura, height=altura)
        for idx, x in ((esq, 0), (dir_, largura / 2)):
            p = paginas[idx]
            pw, ph = float(p.mediabox.width), float(p.mediabox.height)
            escala = min((largura / 2) / pw, altura / ph)
            dx = x + ((largura / 2) - pw * escala) / 2
            dy = (altura - ph * escala) / 2
            folha.merge_transformed_page(p, Transformation().scale(escala, escala).translate(dx, dy))
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()
