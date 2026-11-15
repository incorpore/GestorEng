"""Cliente da API v1 do Documenso (instância self-hosted)."""
import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.sistema.service import get_integracao


def _cfg(db: Session) -> tuple[str, str, dict]:
    cfg, token = get_integracao(db, "documenso")
    base = (cfg.get("base_url") or "").rstrip("/")
    if not base or not token:
        raise HTTPException(400, "Integração com o Documenso não configurada")
    return base, token, cfg


def _req(method: str, url: str, token: str, **kw) -> httpx.Response:
    try:
        with httpx.Client(timeout=60) as c:
            r = c.request(method, url, headers={"Authorization": token, "Accept": "application/json"}, **kw)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Falha de comunicação com o Documenso: {e.__class__.__name__}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Documenso retornou {r.status_code}: {r.text[:300]}")
    return r


def testar(db: Session) -> dict:
    base, token, _ = _cfg(db)
    r = _req("GET", f"{base}/api/v1/documents", token, params={"page": 1, "perPage": 1})
    return {"ok": True, "total": r.json().get("totalPages")}


def enviar(db: Session, *, titulo: str, pdf: bytes, assinantes: list[dict], mensagem: str | None = None) -> dict:
    """Cria o documento, envia o PDF, posiciona um campo de assinatura por assinante na última página e envia."""
    base, token, _ = _cfg(db)
    from io import BytesIO

    from pypdf import PdfReader

    paginas = len(PdfReader(BytesIO(pdf)).pages)
    body = {
        "title": titulo[:250],
        "recipients": [{"name": a["nome"], "email": a["email"], "role": a.get("papel", "SIGNER"),
                        "signingOrder": i + 1} for i, a in enumerate(assinantes)],
        "meta": {"subject": titulo[:250], "message": mensagem or "Por favor, assine o documento.",
                 "signingOrder": "PARALLEL"},
    }
    created = _req("POST", f"{base}/api/v1/documents", token, json=body).json()
    doc_id = created.get("documentId")
    upload_url = created.get("uploadUrl")
    if not doc_id or not upload_url:
        raise HTTPException(502, "Resposta inesperada do Documenso")
    try:
        with httpx.Client(timeout=120) as c:
            up = c.put(upload_url, content=pdf, headers={"Content-Type": "application/pdf"})
        if up.status_code >= 400:
            raise HTTPException(502, f"Falha ao enviar PDF ao Documenso ({up.status_code})")
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Falha ao enviar PDF ao Documenso: {e.__class__.__name__}")
    recipients = created.get("recipients") or []
    n = max(len(recipients), 1)
    for i, rec in enumerate(recipients):
        if rec.get("role", "SIGNER") != "SIGNER":
            continue
        largura = min(30, 90 / n)
        _req("POST", f"{base}/api/v1/documents/{doc_id}/fields", token, json={
            "recipientId": rec.get("recipientId") or rec.get("id"), "type": "SIGNATURE", "pageNumber": paginas,
            "pageX": 5 + i * (90 / n), "pageY": 80, "pageWidth": largura, "pageHeight": 6,
        })
    _req("POST", f"{base}/api/v1/documents/{doc_id}/send", token, json={"sendEmail": True})
    return {"documento_id": str(doc_id), "assinantes": [
        {"nome": r.get("name"), "email": r.get("email"), "status": r.get("signingStatus"),
         "link": r.get("signingUrl")} for r in recipients]}


def status(db: Session, doc_id: str) -> dict:
    base, token, _ = _cfg(db)
    return _req("GET", f"{base}/api/v1/documents/{doc_id}", token).json()


def baixar_assinado(db: Session, doc_id: str) -> bytes:
    base, token, _ = _cfg(db)
    info = _req("GET", f"{base}/api/v1/documents/{doc_id}/download", token).json()
    url = info.get("downloadUrl")
    if not url:
        raise HTTPException(502, "Documento assinado indisponível")
    with httpx.Client(timeout=120) as c:
        r = c.get(url)
    if r.status_code >= 400:
        raise HTTPException(502, "Falha ao baixar documento assinado")
    return r.content
