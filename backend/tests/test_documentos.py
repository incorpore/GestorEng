import io

from pypdf import PdfReader

from app.modules.documentos import render


def test_filtros():
    assert render.f_moeda(1234.5) == "R$ 1.234,50"
    assert render.f_data_extenso("2026-11-15") == "15 de novembro de 2026"
    assert render.f_documento("12345678000199") == "12.345.678/0001-99"
    assert "mil" in render.f_extenso(1200.5) and "reais" in render.f_extenso(1200.5)


def test_sandbox_e_escape():
    out = render.render("{{ x }}", {"x": "<script>alert(1)</script>"})
    assert "<script>" not in out
    try:
        render.render("{{ ''.__class__.__mro__[1].__subclasses__() }}", {})
        raise AssertionError("deveria bloquear")
    except render.RenderError:
        pass
    assert render.render("{{ inexistente.campo }}ok", {}) == "ok"
    assert render.render("[{{ x }}]", {"x": None}) == "[]"


def test_gerar_e_emitir_documento(admin):
    admin.put("/api/configuracoes/empresa", json={"razao_social": "Velmont Engenharia Ltda", "cnpj": "12345678000199",
                                                  "cidade": "Campinas"})
    obra = admin.post("/api/obras", json={"nome": "Escola Municipal", "numero_contrato": "045/2026"}).json()
    modelos = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"]
    assert modelos
    doc = admin.post("/api/documentos-acoes/gerar", json={
        "modelo_id": modelos[0]["id"], "titulo": "Solicitação de aditivo", "entidade": "obra",
        "entidade_id": obra["id"], "destinatario": "Prefeitura Municipal", "variaveis": {"assunto": "Aditivo de prazo"},
    }).json()
    assert doc["numero"].startswith("Ofício nº 001/")
    html = admin.post("/api/documentos-acoes/preview/html", json={"conteudo": doc["conteudo"], "entidade": "obra",
                                                                   "entidade_id": obra["id"], "documento_id": doc["id"],
                                                                   "variaveis": doc["variaveis"]}).json()["html"]
    assert "Escola Municipal" in html and "12.345.678/0001-99" in html and "Aditivo de prazo" in html
    # segundo documento recebe próximo número
    doc2 = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelos[0]["id"], "titulo": "Outro"}).json()
    assert doc2["sequencial"] == doc["sequencial"] + 1
    # timbrado em PNG + margens
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1240, 1754), (240, 240, 255)).save(buf, "PNG")
    r = admin.post("/api/configuracoes/timbrado/arquivo", files={"arquivo": ("timbrado.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200, r.text
    em = admin.post(f"/api/documentos-acoes/{doc['id']}/emitir")
    assert em.status_code == 200, em.text
    assert em.json()["status"] == "emitido"
    pdf = admin.get(f"/api/documentos-acoes/{doc['id']}/pdf")
    assert pdf.headers["content-type"] == "application/pdf"
    text = PdfReader(io.BytesIO(pdf.content)).pages[0].extract_text()
    assert "Escola Municipal" in text
    assert admin.patch(f"/api/documentos/{doc['id']}", json={"titulo": "x"}).status_code == 409
    assert admin.post("/api/documentos", json={"titulo": "x"}).status_code in (405, 422)


def test_timbrado_pdf_e_boletim(admin):
    from weasyprint import HTML

    bg = HTML(string="<p style='color:red'>TIMBRADO VELMONT</p>").write_pdf()
    r = admin.post("/api/configuracoes/timbrado/arquivo", files={"arquivo": ("timbrado.pdf", bg, "application/pdf")})
    assert r.status_code == 200
    obra = admin.post("/api/obras", json={"nome": "Ponte", "valor_contrato": 50000}).json()
    med = admin.post("/api/medicoes", json={"obra_id": obra["id"], "data": "2026-04-01", "itens": [
        {"descricao": "Aterro <b>compactado</b>", "unidade": "m3", "qtd_contratada": 10, "qtd_periodo": 2,
         "preco_unitario": 100}]}).json()
    modelo = admin.get("/api/modelos-documento", params={"tipo": "boletim_medicao"}).json()["items"][0]
    doc = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "BM 1",
                                                         "entidade": "medicao", "entidade_id": med["id"]}).json()
    assert doc["obra_id"] == obra["id"]
    pdf = admin.get(f"/api/documentos-acoes/{doc['id']}/pdf").content
    reader = PdfReader(io.BytesIO(pdf))
    text = reader.pages[0].extract_text()
    assert "TIMBRADO VELMONT" in text and "Aterro <b>compactado</b>" in text and "R$ 200,00" in text
    w, h = float(reader.pages[0].mediabox.width), float(reader.pages[0].mediabox.height)
    assert w > h  # paisagem


def test_variaveis_catalogo(admin):
    cat = admin.get("/api/documentos-acoes/variaveis").json()
    assert any(v["chave"] == "obra.nome" for v in cat["obra"])
    assert any(f["chave"] == "tabela_medicao" for f in cat["_funcoes"])


def test_pdf_bloqueia_recursos_externos(admin):
    r = admin.post("/api/documentos-acoes/preview/pdf", json={
        "conteudo": "<img src='http://169.254.169.254/latest/meta-data'><img src='file:///etc/passwd'><p>ok</p>"})
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_assinatura_representante_legal_e_ordem(admin, monkeypatch):
    from app.modules.documentos import documenso

    enviados = []

    def falso(db, *, titulo, pdf, assinantes, mensagem=None, sequencial=True, pasta_id=None):
        enviados.append({"assinantes": assinantes, "sequencial": sequencial})
        return {"documento_id": "77", "assinantes": [{"nome": a["nome"], "email": a["email"], "status": "NOT_SIGNED"}
                                                      for a in assinantes]}

    monkeypatch.setattr(documenso, "enviar", falso)
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Para assinar"}).json()
    assert admin.post(f"/api/documentos-acoes/{doc['id']}/emitir").status_code == 200
    url = f"/api/documentos-acoes/{doc['id']}/assinatura"
    fiscal = {"nome": "Maria Fiscal", "email": "maria@prefeitura.gov.br"}
    admin.put("/api/configuracoes/empresa", json={"responsavel": "", "email_responsavel": ""})
    r = admin.post(url, json={"assinantes": [fiscal]})
    assert r.status_code == 400 and "representante legal" in r.json()["detail"]

    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge Diretor", "email_responsavel": "jorge@empresa.com.br",
                                                  "cargo_responsavel": "Diretor"})
    padrao = admin.get("/api/documentos-acoes/assinatura/padrao").json()
    assert padrao["representante"] == {"nome": "Jorge Diretor", "email": "jorge@empresa.com.br", "cargo": "Diretor"}
    r = admin.post(url, json={"assinantes": [fiscal]})
    assert r.status_code == 422 and "Jorge Diretor" in r.json()["detail"]
    rep = {"nome": "Jorge Diretor", "email": "JORGE@empresa.com.br"}
    assert admin.post(url, json={"assinantes": [rep, {**fiscal, "email": "jorge@empresa.com.br"}]}).status_code == 422
    # ordem livre (fiscal primeiro), assinatura em sequência
    r = admin.post(url, json={"assinantes": [fiscal, rep], "sequencial": True})
    assert r.status_code == 200, r.text
    assert [a["email"] for a in enviados[-1]["assinantes"]] == ["maria@prefeitura.gov.br", "JORGE@empresa.com.br"]
    assert enviados[-1]["sequencial"] is True and r.json()["status"] == "aguardando_assinatura"
    recentes = admin.get("/api/documentos-acoes/assinatura/padrao").json()["recentes"]
    assert recentes == [{"nome": "Maria Fiscal", "email": "maria@prefeitura.gov.br"}]


class _Resp:
    def __init__(self, dados):
        self._d = dados

    def json(self):
        return self._d


def test_documenso_pastas_e_envio_na_pasta(admin, monkeypatch):
    from app.modules.documentos import documenso

    chamadas = []

    def req(method, url, token, **kw):
        chamadas.append((method, url.split("/api/")[1], kw.get("json"), kw.get("params")))
        if url.endswith("/api/v2/folder"):
            return _Resp({"data": [{"id": "f1", "name": "Obras", "parentId": None},
                                   {"id": "f2", "name": "Escola", "parentId": "f1"}], "totalPages": 1})
        if url.endswith("/api/v2/folder/create"):
            return _Resp({"id": "f3", "name": kw["json"]["name"], "parentId": kw["json"].get("parentId")})
        if url.endswith("/api/v1/documents"):
            return _Resp({"documentId": 55, "uploadUrl": "http://upload",
                          "recipients": [{"recipientId": 1, "name": "A", "email": "a@x.com", "role": "SIGNER"}]})
        return _Resp({})

    class Up:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): ...
        def put(self, *a, **k): return type("R", (), {"status_code": 200})()

    monkeypatch.setattr(documenso, "_req", req)
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://documenso", "tok", {}))
    monkeypatch.setattr(documenso.httpx, "Client", Up)
    assert admin.get("/api/documentos-acoes/documenso/pastas").json() == [
        {"id": "f1", "nome": "Obras", "parent_id": None}, {"id": "f2", "nome": "Escola", "parent_id": "f1"}]
    assert chamadas[-1][3]["type"] == "DOCUMENT"
    nova = admin.post("/api/documentos-acoes/documenso/pastas", json={"nome": " Medições ", "parent_id": "f1"}).json()
    assert nova == {"id": "f3", "nome": "Medições", "parent_id": "f1"}
    assert chamadas[-1][2] == {"name": "Medições", "type": "DOCUMENT", "parentId": "f1"}

    # anexo PDF de uma obra → documento → assinatura dentro da pasta
    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge Diretor", "email_responsavel": "jorge@empresa.com.br"})
    obra = admin.post("/api/obras", json={"nome": "Obra anexos"}).json()
    import io

    from pypdf import PdfWriter

    w = PdfWriter()
    w.add_blank_page(595, 842)
    buf = io.BytesIO()
    w.write(buf)
    arq = admin.post("/api/arquivos", data={"entidade": "obra", "entidade_id": obra["id"]},
                     files={"arquivo": ("Contrato assinado.pdf", buf.getvalue(), "application/pdf")}).json()
    img = admin.post("/api/arquivos", data={"entidade": "obra", "entidade_id": obra["id"]},
                     files={"arquivo": ("f.png", __import__("tests.test_publico_relatorios", fromlist=["PNG"]).PNG, "image/png")}).json()
    assert admin.post(f"/api/documentos-acoes/anexos/{img['id']}").status_code == 415
    p1 = admin.post(f"/api/documentos-acoes/anexos/{arq['id']}").json()
    assert p1["numero"].startswith("Anexo 001/") and p1["status"] == "emitido"
    assert admin.post(f"/api/documentos-acoes/anexos/{arq['id']}").json()["documento_id"] == p1["documento_id"]
    r = admin.post(f"/api/documentos-acoes/{p1['documento_id']}/assinatura",
                   json={"assinantes": [{"nome": "Jorge Diretor", "email": "jorge@empresa.com.br"}], "pasta_id": "f2"})
    assert r.status_code == 200, r.text
    mover = next(c for c in chamadas if c[1] == "v2/document/update")
    assert mover[2] == {"documentId": 55, "data": {"folderId": "f2"}}
    assert [c[1] for c in chamadas][-2:] == ["v2/document/update", "v1/documents/55/send"]
    sit = admin.get("/api/documentos-acoes/anexos", params={"entidade": "obra", "entidade_id": obra["id"]}).json()
    assert sit == [{"arquivo_id": arq["id"], "documento_id": p1["documento_id"], "numero": p1["numero"],
                    "status": "aguardando_assinatura", "assinantes": sit[0]["assinantes"]}]


def test_pasta_automatica_erp_cliente_obra_tipo(admin, monkeypatch):
    import io

    from pypdf import PdfWriter

    from app.modules.documentos import documenso

    pastas = [{"id": "x1", "name": "ERP", "parentId": None}]
    chamadas = []

    def req(method, url, token, **kw):
        rota = url.split("/api/")[1]
        chamadas.append((rota, kw.get("json")))
        if rota == "v2/folder":
            return _Resp({"data": list(pastas), "totalPages": 1})
        if rota == "v2/folder/create":
            p = {"id": f"x{len(pastas) + 1}", "name": kw["json"]["name"], "parentId": kw["json"].get("parentId")}
            pastas.append(p)
            return _Resp(p)
        if rota == "v1/documents":
            return _Resp({"documentId": 70, "uploadUrl": "http://u", "recipients": []})
        return _Resp({})

    class Up:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): ...
        def put(self, *a, **k): return type("R", (), {"status_code": 200})()

    monkeypatch.setattr(documenso, "_req", req)
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://d", "t", {}))
    monkeypatch.setattr(documenso.httpx, "Client", Up)
    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge", "email_responsavel": "jorge@empresa.com.br"})
    cli = admin.post("/api/parceiros", json={"tipo": "orgao", "pessoa": "PJ", "nome": "Município de Vargem",
                                             "nome_fantasia": "Prefeitura de Vargem"}).json()
    obra = admin.post("/api/obras", json={"nome": "Rua do Cemitério / Trecho 2", "cliente_id": cli["id"]}).json()
    w = PdfWriter()
    w.add_blank_page(595, 842)
    buf = io.BytesIO()
    w.write(buf)
    arq = admin.post("/api/arquivos", data={"entidade": "obra", "entidade_id": obra["id"]},
                     files={"arquivo": ("Planilha medição 03.pdf", buf.getvalue(), "application/pdf")}).json()
    doc_id = admin.post(f"/api/documentos-acoes/anexos/{arq['id']}").json()["documento_id"]
    prev = admin.get("/api/documentos-acoes/assinatura/padrao", params={"documento_id": doc_id}).json()
    assert prev["pasta_auto"] == ["ERP", "Prefeitura de Vargem", "Rua do Cemitério - Trecho 2", "Anexos"]
    assert prev["nome"] == "Planilha medição 03.pdf"
    rep = {"nome": "Jorge", "email": "jorge@empresa.com.br"}
    r = admin.post(f"/api/documentos-acoes/{doc_id}/assinatura", json={"assinantes": [rep]})
    assert r.status_code == 200, r.text
    # ERP já existia: cria só cliente, obra e Anexos, em cadeia
    criadas = [c[1] for c in chamadas if c[0] == "v2/folder/create"]
    assert criadas == [{"name": "Prefeitura de Vargem", "type": "DOCUMENT", "parentId": "x1"},
                       {"name": "Rua do Cemitério - Trecho 2", "type": "DOCUMENT", "parentId": "x2"},
                       {"name": "Anexos", "type": "DOCUMENT", "parentId": "x3"}]
    assert next(c[1] for c in chamadas if c[0] == "v1/documents")["title"] == "Planilha medição 03.pdf"
    assert next(c[1] for c in chamadas if c[0] == "v2/document/update") == {"documentId": 70, "data": {"folderId": "x4"}}
    # segundo documento da mesma obra reaproveita as pastas
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc2 = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Pedido de aditivo",
                                                           "entidade": "obra", "entidade_id": obra["id"]}).json()
    admin.post(f"/api/documentos-acoes/{doc2['id']}/emitir")
    chamadas.clear()
    assert admin.post(f"/api/documentos-acoes/{doc2['id']}/assinatura", json={"assinantes": [rep]}).status_code == 200
    assert [c[1]["name"] for c in chamadas if c[0] == "v2/folder/create"] == ["Documentos"]
    titulo = next(c[1] for c in chamadas if c[0] == "v1/documents")["title"]
    assert titulo.startswith("Ofício nº") and titulo.endswith(" - Pedido de aditivo.pdf") and "/" not in titulo


def test_documenso_inacessivel_e_resposta_html_dao_mensagem_clara(admin, monkeypatch):
    import time

    import httpx

    from app.modules.documentos import documenso

    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge", "email_responsavel": "jorge@empresa.com.br"})
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Teste conexão"}).json()
    admin.post(f"/api/documentos-acoes/{doc['id']}/emitir")
    url = f"/api/documentos-acoes/{doc['id']}/assinatura"
    corpo = {"assinantes": [{"nome": "Jorge", "email": "jorge@empresa.com.br"}]}

    # porta fechada: falha rápida, sem tentar criar o documento, e diz o que fazer
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://127.0.0.1:9", "t", {}))
    t0 = time.monotonic()
    r = admin.post(url, json=corpo)
    assert r.status_code == 502 and "não conseguiu conectar ao Documenso em 127.0.0.1:9" in r.json()["detail"]
    assert time.monotonic() - t0 < 15
    assert admin.get(f"/api/documentos/{doc['id']}").json()["status"] == "emitido"

    # Documenso devolvendo página HTML (URL errada): 502 com explicação, nunca 500
    class Html:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): ...

        def request(self, method, u, **kw):
            return httpx.Response(200, text="<!doctype html><html>login</html>", request=httpx.Request(method, u))

    monkeypatch.setattr(documenso.httpx, "Client", Html)
    r = admin.post(url, json=corpo)
    assert r.status_code == 502 and "não é JSON" in r.json()["detail"]
