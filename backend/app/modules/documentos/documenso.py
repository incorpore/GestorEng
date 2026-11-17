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


# conectar rápido (o Cloudflare/proxy corta requisições longas); ler com folga para PDFs grandes
TEMPO = httpx.Timeout(45, connect=8)


class DocumensoFora(HTTPException):
    """O Documenso não respondeu (endereço inacessível a partir do servidor do Struvia)."""


class _Resp:
    """Resposta do Documenso com leitura segura do JSON."""

    def __init__(self, r: httpx.Response, rota: str):
        self.r, self.rota, self.status_code = r, rota, r.status_code
        self.headers, self.content = r.headers, r.content

    @property
    def text(self) -> str:
        return self.r.text

    def json(self) -> dict:
        try:
            dados = self.r.json()
        except ValueError:
            raise HTTPException(424, f"Resposta inesperada do Documenso em {self.rota} (não é JSON). "
                                     "Confira a URL do Documenso em Configurações > Integrações.")
        return dados if isinstance(dados, dict) else {"data": dados}


def _req(method: str, url: str, token: str, **kw) -> _Resp:
    rota = "/" + url.split("/", 3)[-1] if "://" in url else url
    try:
        with httpx.Client(timeout=TEMPO) as c:
            r = c.request(method, url, headers={"Authorization": token, "Accept": "application/json", "User-Agent": "Struvia"}, **kw)
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        host = url.split("/")[2] if "://" in url else url
        raise DocumensoFora(424, f"O servidor do Struvia não conseguiu conectar ao Documenso em {host} "
                                 f"({e.__class__.__name__}). Use um endereço acessível a partir do servidor "
                                 "(ex.: http://IP-DO-ZIMAOS:PORTA) em Configurações > Integrações e clique em Testar.")
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Falha de comunicação com o Documenso: {e.__class__.__name__}")
    html = "html" in (r.headers.get("content-type") or "") or r.content[:15].lower().startswith((b"<!doctype", b"<html"))
    if r.headers.get("cf-mitigated") or (r.status_code in (403, 503) and html and "cloudflare" in r.text[:5000].lower()):
        raise HTTPException(424, "O Cloudflare bloqueou o acesso do servidor do Struvia ao Documenso (proteção contra "
                                 "robôs). Use o endereço local do Documenso (ex.: http://192.168.3.100:PORTA) em "
                                 "Configurações > Integrações.")
    if r.status_code in (401, 403):
        raise HTTPException(424, "O Documenso recusou o token da API (401/403). Gere um novo token e salve em "
                                 "Configurações > Integrações.")
    if r.status_code >= 400:
        erro = HTTPException(424, f"Documenso retornou {r.status_code} em {rota}: {r.text[:300]}")
        erro.remoto = r.status_code  # type: ignore[attr-defined]
        raise erro
    return _Resp(r, rota)


def testar(db: Session) -> dict:
    base, token, _ = _cfg(db)
    try:
        _req("GET", f"{base}/api/v2/folder", token, params={"type": "DOCUMENT", "perPage": 1}).json()
        return {"ok": True, "mensagem": "Conectado ao Documenso (API v2: assinatura e pastas disponíveis)."}
    except HTTPException as e:
        if not _nao_existe(e):
            raise
    _req("GET", f"{base}/api/v1/documents", token, params={"page": 1, "perPage": 1}).json()
    return {"ok": True, "mensagem": "Conectado, mas este Documenso não tem a API v2: pastas indisponíveis e o envio "
                                    "só funciona se ele usar armazenamento S3. Recomenda-se atualizar o Documenso."}


# ------------------------------------------------------------------ pastas (API v2 do Documenso)
def pastas(db: Session) -> list[dict]:
    """Pastas de documentos do Documenso (com subpastas via parent_id)."""
    base, token, _ = _cfg(db)
    itens, pagina = [], 1
    while True:
        try:
            r = _req("GET", f"{base}/api/v2/folder", token, params={"type": "DOCUMENT", "page": pagina, "perPage": 100})
        except DocumensoFora:
            raise
        except HTTPException as e:
            if " 404" in str(e.detail):
                raise HTTPException(400, "Este Documenso não oferece pastas pela API. Atualize o Documenso para usar pastas.")
            raise
        dados = r.json()
        itens += [{"id": str(f["id"]), "nome": f.get("name") or "", "parent_id": f.get("parentId")}
                  for f in dados.get("data", []) if isinstance(f, dict) and f.get("id")]
        if pagina >= (dados.get("totalPages") or 1) or pagina >= 20:
            break
        pagina += 1
    return itens


def criar_pasta(db: Session, nome: str, parent_id: str | None = None) -> dict:
    base, token, _ = _cfg(db)
    body = {"name": nome, "type": "DOCUMENT", **({"parentId": parent_id} if parent_id else {})}
    f = _req("POST", f"{base}/api/v2/folder/create", token, json=body).json()
    if not f.get("id"):
        raise HTTPException(424, "Resposta inesperada do Documenso ao criar pasta")
    return {"id": str(f["id"]), "nome": f.get("name") or nome, "parent_id": f.get("parentId")}


PASTA_PADRAO = "ERP/{{cliente}}/{{obra}}/{{tipo}}"


def nome_pasta(texto: str) -> str:
    texto = " ".join((texto or "").replace("/", "-").replace("\\", "-").split())
    return texto[:120]


def garantir_caminho(db: Session, partes: list[str]) -> str:
    """Encontra (ou cria) a sequência de pastas, ex.: ERP › Cliente › Obra › Documentos. Retorna o id da última."""
    existentes = pastas(db)
    pai: str | None = None
    for parte in partes:
        achada = next((p for p in existentes if p["parent_id"] == pai and p["nome"].casefold() == parte.casefold()), None)
        if not achada:
            achada = criar_pasta(db, parte, pai)
            existentes.append(achada)
        pai = achada["id"]
    return pai


def mover_para_pasta(db: Session, doc_id: str, pasta_id: str) -> None:
    base, token, _ = _cfg(db)
    _req("POST", f"{base}/api/v2/document/update", token, json={"documentId": int(doc_id), "data": {"folderId": pasta_id}})


def _nao_existe(e: HTTPException) -> bool:
    """A rota não existe nesta versão do Documenso (404/405)."""
    return getattr(e, "remoto", None) in (404, 405)


def _campos_assinatura(assinantes: list[dict], paginas: int) -> list[list[dict]]:
    """Um campo de assinatura por assinante (papel SIGNER) lado a lado no rodapé da última página (valores em %)."""
    n = max(len(assinantes), 1)
    largura = min(30, 90 / n)
    return [[{"type": "SIGNATURE", "pageNumber": paginas, "pageX": round(5 + i * (90 / n), 2), "pageY": 80,
              "width": round(largura, 2), "height": 6}] if a.get("papel", "SIGNER") == "SIGNER" else []
            for i, a in enumerate(assinantes)]


def enviar(db: Session, *, titulo: str, pdf: bytes, assinantes: list[dict], mensagem: str | None = None,
           sequencial: bool = True, pasta_id: str | None = None) -> dict:
    """Envia para assinatura pela API v2 (o PDF vai na mesma requisição — funciona com o Documenso guardando arquivos
    no banco, sem S3). Em Documenso antigo, sem API v2, usa a API v1."""
    import json
    from io import BytesIO

    from pypdf import PdfReader

    base, token, _ = _cfg(db)
    paginas = len(PdfReader(BytesIO(pdf)).pages)
    campos = _campos_assinatura(assinantes, paginas)
    meta = {"subject": titulo[:250], "message": mensagem or "Por favor, assine o documento.",
            "signingOrder": "SEQUENTIAL" if sequencial else "PARALLEL"}
    payload = {"title": titulo[:250], "meta": meta,
               "recipients": [{"name": a["nome"], "email": a["email"], "role": a.get("papel", "SIGNER"), "signingOrder": i + 1,
                               "fields": campos[i]} for i, a in enumerate(assinantes)],
               **({"folderId": pasta_id} if pasta_id else {})}
    try:
        criado = _req("POST", f"{base}/api/v2/document/create", token,
                      data={"payload": json.dumps(payload, ensure_ascii=False)},
                      files={"file": (titulo[:200] if titulo.lower().endswith(".pdf") else f"{titulo[:200]}.pdf", pdf,
                                      "application/pdf")}).json()
    except HTTPException as e:
        if _nao_existe(e):
            return _enviar_v1(db, titulo=titulo, pdf=pdf, assinantes=assinantes, mensagem=mensagem,
                              sequencial=sequencial, pasta_id=pasta_id, campos=campos)
        raise
    doc_id = criado.get("id") or criado.get("documentId")
    if not doc_id:
        raise HTTPException(424, "Resposta inesperada do Documenso ao criar o documento")
    _req("POST", f"{base}/api/v2/document/distribute", token, json={"documentId": int(doc_id), "meta": meta})
    try:
        recs = status(db, str(doc_id)).get("recipients") or []
    except HTTPException:
        recs = [{"name": a["nome"], "email": a["email"], "signingStatus": "NOT_SIGNED"} for a in assinantes]
    return {"documento_id": str(doc_id), "aviso": None, "assinantes": [
        {"nome": r.get("name"), "email": r.get("email"), "status": r.get("signingStatus")} for r in recs]}


def _enviar_v1(db: Session, *, titulo: str, pdf: bytes, assinantes: list[dict], mensagem: str | None,
               sequencial: bool, pasta_id: str | None, campos: list[list[dict]]) -> dict:
    """API v1 (Documenso antigo). Exige o Documenso configurado com armazenamento S3."""
    base, token, _ = _cfg(db)
    body = {
        "title": titulo[:250],
        "recipients": [{"name": a["nome"], "email": a["email"], "role": a.get("papel", "SIGNER"),
                        "signingOrder": i + 1} for i, a in enumerate(assinantes)],
        "meta": {"subject": titulo[:250], "message": mensagem or "Por favor, assine o documento.",
                 "signingOrder": "SEQUENTIAL" if sequencial else "PARALLEL"},
    }
    try:
        created = _req("POST", f"{base}/api/v1/documents", token, json=body).json()
    except HTTPException as e:
        if "S3" in str(e.detail):
            raise HTTPException(424, "Este Documenso guarda arquivos no banco (sem S3) e não oferece a API v2. "
                                     "Atualize o Documenso para uma versão recente.")
        raise
    doc_id = created.get("documentId")
    upload_url = created.get("uploadUrl")
    if not doc_id or not upload_url:
        raise HTTPException(424, "Resposta inesperada do Documenso")
    try:
        with httpx.Client(timeout=httpx.Timeout(90, connect=8)) as c:
            up = c.put(upload_url, content=pdf, headers={"Content-Type": "application/pdf"})
        if up.status_code >= 400:
            raise HTTPException(424, f"Falha ao enviar PDF ao Documenso ({up.status_code})")
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Falha ao enviar PDF ao Documenso: {e.__class__.__name__}")
    ordem = {a["email"].lower(): i for i, a in enumerate(assinantes)}
    recipients = sorted(created.get("recipients") or [], key=lambda x: ordem.get((x.get("email") or "").lower(), 99))
    for i, rec in enumerate(recipients):
        for f in (campos[i] if i < len(campos) else []):
            _req("POST", f"{base}/api/v1/documents/{doc_id}/fields", token, json={
                "recipientId": rec.get("recipientId") or rec.get("id"), "type": f["type"], "pageNumber": f["pageNumber"],
                "pageX": f["pageX"], "pageY": f["pageY"], "pageWidth": f["width"], "pageHeight": f["height"]})
    aviso = None
    if pasta_id:
        try:
            mover_para_pasta(db, str(doc_id), pasta_id)
        except DocumensoFora:
            raise
        except HTTPException as e:  # o envio continua; só não fica organizado na pasta
            aviso = f"Enviado, mas não foi possível colocar na pasta: {e.detail}"
    _req("POST", f"{base}/api/v1/documents/{doc_id}/send", token, json={"sendEmail": True})
    return {"documento_id": str(doc_id), "aviso": aviso, "assinantes": [
        {"nome": r.get("name"), "email": r.get("email"), "status": r.get("signingStatus"),
         "link": r.get("signingUrl")} for r in recipients]}


def status(db: Session, doc_id: str) -> dict:
    base, token, _ = _cfg(db)
    try:
        return _req("GET", f"{base}/api/v2/document/{int(doc_id)}", token).json()
    except HTTPException as e:
        if not _nao_existe(e):
            raise
    return _req("GET", f"{base}/api/v1/documents/{doc_id}", token).json()


def baixar_assinado(db: Session, doc_id: str) -> bytes:
    base, token, _ = _cfg(db)
    try:
        r = _req("GET", f"{base}/api/v2/document/{int(doc_id)}/download", token, params={"version": "signed"})
        if r.content[:5] == b"%PDF-":
            return r.content
        url = r.json().get("downloadUrl") or r.json().get("url")
        if url:
            return _baixar(url)
    except HTTPException as e:
        if not _nao_existe(e):
            raise
    info = _req("GET", f"{base}/api/v1/documents/{doc_id}/download", token).json()
    url = info.get("downloadUrl")
    if not url:
        raise HTTPException(424, "Documento assinado indisponível")
    return _baixar(url)


def _baixar(url: str) -> bytes:
    try:
        with httpx.Client(timeout=httpx.Timeout(90, connect=8)) as c:
            r = c.get(url)
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Falha ao baixar documento assinado: {e.__class__.__name__}")
    if r.status_code >= 400 or r.content[:5] != b"%PDF-":
        raise HTTPException(424, "Falha ao baixar documento assinado")
    return r.content
