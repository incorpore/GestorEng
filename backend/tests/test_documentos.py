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
