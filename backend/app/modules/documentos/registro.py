"""Registro de PDFs gerados pelo sistema (diário, cartilha...) como documentos emitidos —
numerados, guardados e prontos para assinatura no Documenso."""
import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.models import Arquivo

from .models import Documento

log = logging.getLogger(__name__)


def reservar(db: Session, *, tipo: str, prefixo: str, titulo: str, entidade: str | None, entidade_id: int | None,
             obra_id: int | None, user_id: int | None, status: str = "gerando") -> Documento:
    from .module import _proximo_numero

    hoje = date.today()
    seq = _proximo_numero(db, tipo, hoje.year)
    doc = Documento(tipo=tipo, ano=hoje.year, sequencial=seq, numero=f"{prefixo} {seq:03d}/{hoje.year}", titulo=titulo,
                    data_emissao=hoje, entidade=entidade, entidade_id=entidade_id, obra_id=obra_id, conteudo="",
                    usar_timbrado=False, status=status, criado_por_id=user_id, variaveis={})
    db.add(doc)
    db.flush()
    return doc


def concluir(db: Session, doc: Documento, pdf: bytes, user_id: int | None) -> Documento:
    nome = f"{(doc.numero or doc.titulo).replace('/', '-')} - {doc.titulo}"[:180] + ".pdf"
    meta = storage.save_bytes(pdf, nome, mime="application/pdf")
    a = Arquivo(**meta, entidade="documento", entidade_id=doc.id, enviado_por_id=user_id)
    db.add(a)
    db.flush()
    doc.pdf_arquivo_id, doc.status = a.id, "emitido"
    doc.variaveis = {**(doc.variaveis or {}), "_progresso": None, "_paginas": _paginas(pdf)}
    audit.log(db, user_id=user_id, action="emitir", entity="documento", entity_id=doc.id, data={"sha256": meta["sha256"]})
    return doc


def falhar(db: Session, doc: Documento, erro: Exception) -> None:
    log.exception("Falha ao gerar documento %s", doc.id)
    doc.status = "erro"
    doc.variaveis = {**(doc.variaveis or {}), "_progresso": f"Falha ao gerar: {erro.__class__.__name__}"}


def progresso(db: Session, doc_id: int, texto: str) -> None:
    doc = db.get(Documento, doc_id)
    if doc:
        doc.variaveis = {**(doc.variaveis or {}), "_progresso": texto}
        db.commit()


def _paginas(pdf: bytes) -> int:
    import io

    from pypdf import PdfReader

    return len(PdfReader(io.BytesIO(pdf)).pages)
