import io
import json

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

    def falso(db, *, titulo, pdf, assinantes, mensagem=None, sequencial=True, pasta_id=None, posicoes=None):
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
        corpo = kw.get("json") or (json.loads(kw["data"]["payload"]) if kw.get("data") else None)
        chamadas.append((method, url.split("/api/")[1], corpo, kw.get("params")))
        if url.endswith("/api/v2/folder"):
            return _Resp({"data": [{"id": "f1", "name": "Obras", "parentId": None},
                                   {"id": "f2", "name": "Escola", "parentId": "f1"}], "totalPages": 1})
        if url.endswith("/api/v2/folder/create"):
            return _Resp({"id": "f3", "name": kw["json"]["name"], "parentId": kw["json"].get("parentId")})
        if url.endswith("/api/v2/document/create"):
            assert kw["files"]["file"][2] == "application/pdf" and kw["files"]["file"][1][:5] == b"%PDF-"
            return _Resp({"id": 55, "envelopeId": "envelope_1"})
        if url.endswith("/api/v2/document/55"):
            return _Resp({"status": "PENDING", "recipients": [{"name": "Jorge Diretor", "email": "jorge@empresa.com.br",
                                                               "signingStatus": "NOT_SIGNED"}]})
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
    criado = next(c for c in chamadas if c[1] == "v2/document/create")[2]
    assert criado["folderId"] == "f2" and criado["title"].startswith("Contrato assinado")
    assert criado["recipients"][0]["fields"][0]["type"] == "SIGNATURE" and criado["meta"]["signingOrder"] == "SEQUENTIAL"
    assert [c[1] for c in chamadas][-2:] == ["v2/document/distribute", "v2/document/55"]
    assert next(c for c in chamadas if c[1] == "v2/document/distribute")[2]["documentId"] == 55
    assert not any(c[1].startswith("v1/") for c in chamadas)
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
        chamadas.append((rota, kw.get("json") or (json.loads(kw["data"]["payload"]) if kw.get("data") else None)))
        if rota == "v2/folder":
            return _Resp({"data": list(pastas), "totalPages": 1})
        if rota == "v2/folder/create":
            p = {"id": f"x{len(pastas) + 1}", "name": kw["json"]["name"], "parentId": kw["json"].get("parentId")}
            pastas.append(p)
            return _Resp(p)
        if rota == "v2/document/create":
            return _Resp({"id": 70, "envelopeId": "envelope_70"})
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
    criado = next(c[1] for c in chamadas if c[0] == "v2/document/create")
    assert criado["title"] == "Planilha medição 03.pdf" and criado["folderId"] == "x4"
    # segundo documento da mesma obra reaproveita as pastas
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc2 = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Pedido de aditivo",
                                                           "entidade": "obra", "entidade_id": obra["id"]}).json()
    admin.post(f"/api/documentos-acoes/{doc2['id']}/emitir")
    chamadas.clear()
    assert admin.post(f"/api/documentos-acoes/{doc2['id']}/assinatura", json={"assinantes": [rep]}).status_code == 200
    assert [c[1]["name"] for c in chamadas if c[0] == "v2/folder/create"] == ["Documentos"]
    titulo = next(c[1] for c in chamadas if c[0] == "v2/document/create")["title"]
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
    assert r.status_code == 424 and "não conseguiu conectar ao Documenso em 127.0.0.1:9" in r.json()["detail"]
    assert time.monotonic() - t0 < 15
    assert admin.get(f"/api/documentos/{doc['id']}").json()["status"] == "emitido"

    # Documenso devolvendo página HTML (URL errada): 424 com explicação, nunca 500
    class Html:
        def __init__(self, *a, **k): ...
        def __enter__(self): return self
        def __exit__(self, *a): ...

        def request(self, method, u, **kw):
            return httpx.Response(200, text="<!doctype html><html>login</html>", request=httpx.Request(method, u))

    monkeypatch.setattr(documenso.httpx, "Client", Html)
    r = admin.post(url, json=corpo)
    assert r.status_code == 424 and "não é JSON" in r.json()["detail"]


def test_documenso_antigo_sem_v2_usa_v1_e_explica_falta_de_s3(admin, monkeypatch):
    from fastapi import HTTPException

    from app.modules.documentos import documenso

    rotas = []

    def req(method, url, token, **kw):
        rota = url.split("/api/")[1]
        rotas.append(rota)
        if rota.startswith("v2/"):
            e = HTTPException(424, f"Documenso retornou 404 em /api/{rota}: not found")
            e.remoto = 404
            raise e
        if rota == "v1/documents":
            raise HTTPException(424, 'Documenso retornou 500 em /api/v1/documents: '
                                     '{"message":"Create document is not available without S3 transport."}')
        return _Resp({})

    monkeypatch.setattr(documenso, "_req", req)
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://d", "t", {}))
    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge", "email_responsavel": "jorge@empresa.com.br"})
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Antigo"}).json()
    admin.post(f"/api/documentos-acoes/{doc['id']}/emitir")
    r = admin.post(f"/api/documentos-acoes/{doc['id']}/assinatura",
                   json={"assinantes": [{"nome": "Jorge", "email": "jorge@empresa.com.br"}], "pasta_auto": False})
    assert r.status_code == 424 and "sem S3" in r.json()["detail"] and "Atualize o Documenso" in r.json()["detail"]
    assert rotas == ["v2/document/create", "v1/documents"]


def test_documenso_v2_status_e_download_assinado(monkeypatch):
    from app.modules.documentos import documenso

    class R:
        def __init__(self, dados=None, content=b""):
            self._d, self.content = dados or {}, content

        def json(self):
            return self._d

    vistos = []

    def req(method, url, token, **kw):
        vistos.append((url.split("/api/")[1], kw.get("params")))
        if url.endswith("/download"):
            return R(content=b"%PDF-1.7 assinado")
        return R({"status": "COMPLETED", "recipients": [{"name": "A", "email": "a@x", "signingStatus": "SIGNED"}]})

    monkeypatch.setattr(documenso, "_req", req)
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://d", "t", {}))
    assert documenso.status(None, "12")["status"] == "COMPLETED"
    assert documenso.baixar_assinado(None, "12") == b"%PDF-1.7 assinado"
    assert vistos == [("v2/document/12", None), ("v2/document/12/download", {"version": "signed"})]


def _pdf_assinaturas() -> bytes:
    from weasyprint import HTML

    return HTML(string="""<html><body style='font-family:Arial;font-size:11pt'><div style='padding:30mm 20mm'>
    <p>Termo de aceite da obra.</p>
    <p style='margin-top:30mm;text-align:center'>______________________________<br><b>Jorge Diretor</b><br>Diretor</p>
    <table style='width:100%;margin-top:20mm'><tr>
    <td style='text-align:center;width:50%'>______________________________<br>Maria Fiscal<br>Fiscal</td>
    <td style='text-align:center;width:50%'>______________________________<br>Carlos Técnico<br>RT</td></tr></table>
    </div></body></html>""").write_pdf()


def test_detectar_campos_por_texto_e_por_ia(admin, monkeypatch):
    from app.modules.documentos import campos

    pdf = _pdf_assinaturas()
    ass = [{"nome": "Maria Fiscal", "email": "m@x.com"}, {"nome": "Jorge Diretor", "email": "j@x.com"},
           {"nome": "Carlos Técnico", "email": "c@x.com"}, {"nome": "Só Cópia", "email": "s@x.com", "papel": "CC"}]
    r = campos.detectar(pdf, ass)
    por = {c["indice"]: c for c in r["campos"]}
    assert r["metodo"] == "texto" and set(por) == {0, 1, 2}
    # Maria à esquerda, Carlos à direita, mesma altura; Jorge acima dos dois; campos acima dos nomes
    assert por[0]["x"] < 50 < por[2]["x"] and abs(por[0]["y"] - por[2]["y"]) < 0.5 and por[1]["y"] < por[0]["y"]
    nomes = {linha.texto: linha for linha in campos.linhas(pdf)}
    assert por[1]["y"] + por[1]["altura"] < nomes["Jorge Diretor"].y

    # IA devolvendo JSON (com texto em volta) — usado como veio, ajustado aos limites
    resposta = 'Aqui está: {"campos": [{"assinante": 1, "pagina": 1, "x": 35, "y": 30, "largura": 30, "altura": 6, ' \
               '"referencia": "Jorge Diretor"}, {"assinante": 3, "pagina": 1, "x": 1, "y": 1}, ' \
               '{"assinante": 0, "pagina": 9, "x": 1, "y": 1}]}'
    r = campos.detectar(pdf, ass, chamar=lambda msgs: resposta)
    por = {c["indice"]: c for c in r["campos"]}
    assert r["metodo"] == "ia" and por[1]["origem"] == "ia" and por[1]["x"] == 35
    # quem a IA não achou (0 com página inválida, 2 ausente) vem da busca no texto; cópia (3) nunca recebe campo
    assert por[0]["origem"] == "texto" and por[2]["origem"] == "texto" and 3 not in por
    # IA quebrada: avisa e usa o texto
    r = campos.detectar(pdf, ass, chamar=lambda msgs: "não sei")
    assert r["metodo"] == "texto" and "IA" in r["aviso"] and len(r["campos"]) == 3


def test_detectar_endpoint_e_envio_com_posicoes(admin, monkeypatch):
    from app.core import storage
    from app.modules.documentos import documenso
    from app.modules.ia import module as ia

    admin.put("/api/configuracoes/empresa", json={"responsavel": "Jorge Diretor", "email_responsavel": "j@x.com"})
    modelo = admin.get("/api/modelos-documento", params={"tipo": "oficio"}).json()["items"][0]
    doc = admin.post("/api/documentos-acoes/gerar", json={"modelo_id": modelo["id"], "titulo": "Aceite"}).json()
    admin.post(f"/api/documentos-acoes/{doc['id']}/emitir")
    # troca o PDF emitido pelo PDF de teste com blocos de assinatura
    from app.core.database import SessionLocal
    from app.core.models import Arquivo
    from app.modules.documentos.models import Documento

    with SessionLocal() as db:
        a = db.get(Arquivo, db.get(Documento, doc["id"]).pdf_arquivo_id)
        storage.path_for(a.uuid).write_bytes(_pdf_assinaturas())
    url = f"/api/documentos-acoes/{doc['id']}/assinatura"
    ass = [{"nome": "Jorge Diretor", "email": "j@x.com"}, {"nome": "Maria Fiscal", "email": "m@x.com"}]
    # sem OpenRouter configurado → busca pelo texto
    r = admin.post(f"{url}/detectar", json={"assinantes": ass})
    assert r.status_code == 200, r.text
    assert r.json()["metodo"] == "texto" and len(r.json()["campos"]) == 2 and r.json()["paginas"][0]["largura"] > 500
    # com OpenRouter → IA
    admin.put("/api/integracoes/openrouter", json={"config": {}, "segredo": "sk-teste"})
    monkeypatch.setattr(ia, "_call", lambda db, msgs, modelo=None, max_tokens=4000:
                        '{"campos": [{"assinante": 0, "pagina": 1, "x": 40, "y": 33, "largura": 25, "altura": 6}]}')
    r = admin.post(f"{url}/detectar", json={"assinantes": ass}).json()
    assert r["metodo"] == "ia" and r["campos"][0]["x"] == 40 and r["campos"][1]["origem"] == "texto"

    # envio usa as posições informadas
    enviados = []

    def req(method, u, token, **kw):
        if u.endswith("/api/v2/document/create"):
            enviados.append(json.loads(kw["data"]["payload"]))
            return _Resp({"id": 9})
        return _Resp({"recipients": []})

    monkeypatch.setattr(documenso, "_req", req)
    monkeypatch.setattr(documenso, "_cfg", lambda db: ("http://d", "t", {}))
    pos = [{"indice": 0, "pagina": 1, "x": 40, "y": 33, "largura": 25, "altura": 6},
           {"indice": 1, "pagina": 1, "x": 90, "y": 50, "largura": 25, "altura": 6}]
    r = admin.post(url, json={"assinantes": ass, "pasta_auto": False, "campos": pos})
    assert r.status_code == 200, r.text
    f0, f1 = (rec["fields"][0] for rec in enviados[0]["recipients"])
    assert f0 == {"type": "SIGNATURE", "pageNumber": 1, "pageX": 40, "pageY": 33, "width": 25, "height": 6}
    assert f1["pageX"] == 90 and f1["width"] == 10  # não ultrapassa a borda da página
