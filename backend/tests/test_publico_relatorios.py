import io
from datetime import UTC, date, datetime, timedelta

from PIL import Image
from pypdf import PdfReader

PNG = io.BytesIO()
Image.new("RGB", (1200, 900), (120, 140, 160)).save(PNG, "PNG")
PNG = PNG.getvalue()
RETRATO = io.BytesIO()
Image.new("RGB", (900, 1200), (160, 140, 120)).save(RETRATO, "JPEG")
RETRATO = RETRATO.getvalue()


def _obra_diario(admin, nome="Obra pública"):
    o = admin.post("/api/obras", json={"nome": nome, "status": "em_andamento", "latitude": "-27.49",
                                       "longitude": "-50.97", "cidade": "Vargem", "uf": "SC"}).json()
    d = admin.post("/api/diarios", json={
        "obra_id": o["id"], "data": str(date.today() - timedelta(days=1)),
        "efetivo": [{"nome": "Ari", "funcao": "Servente", "horas": 8}],
        "atividades": [{"descricao": "Bocas de lobo", "percentual": 50}],
        "pendencias": [{"descricao": "Liberar tubos"}],
        "clima_detalhe": {"manha": {"condicao": "nublado", "temp_min": 13.6, "temp_max": 20.6, "umidade": 85}}}).json()
    for nome_arq, dados in (("h.png", PNG), ("v.jpg", RETRATO)):
        admin.post("/api/arquivos", data={"entidade": "diario", "entidade_id": d["id"], "descricao": "Boca de lobo"},
                   files={"arquivo": (nome_arq, dados, "image/png")})
    return o, d


def test_link_pedir_fotos_registra_ip_e_coordenadas(admin, client):
    o, d = _obra_diario(admin)
    link = admin.post("/api/links-publicos", json={"tipo": "fotos", "entidade": "diario", "entidade_id": d["id"],
                                                   "destinatario": "Encarregado João", "max_fotos": 5}).json()
    token = link["url"].split("/p/")[1]
    h = {"X-Forwarded-For": "1.1.1.1, 203.0.113.9", "User-Agent": "Celular Teste"}
    info = client.get(f"/api/publico/l/{token}", headers=h).json()
    assert info["tipo"] == "fotos" and info["exige_localizacao"] and info["obra"]["nome"] == o["nome"]
    negada = client.post(f"/api/publico/l/{token}/localizacao", json={"negada": True, "motivo": "PERMISSION_DENIED"}, headers=h)
    assert negada.status_code == 403
    sess = client.post(f"/api/publico/l/{token}/localizacao",
                       json={"latitude": -27.4946, "longitude": -50.9797, "precisao": 12, "nome": "João"}, headers=h).json()["sessao"]
    assert client.get(f"/api/publico/l/{token}/conteudo", headers={**h, "X-Link-Sessao": sess}).json()["tipo"] == "fotos"
    r = client.post(f"/api/publico/l/{token}/fotos", headers=h,
                    data={"sessao": sess, "nome": "João", "latitude": -27.4946, "longitude": -50.9797, "descricao": "Vala"},
                    files={"arquivo": ("foto.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    assert r.json()["coord_fonte"] == "dispositivo"
    assert client.post(f"/api/publico/l/{token}/fotos", headers=h, data={"sessao": "x"},
                       files={"arquivo": ("f.png", PNG, "image/png")}).status_code == 401
    acessos = admin.get(f"/api/links-publicos/{link['id']}/acessos").json()
    eventos = [a["evento"] for a in acessos]
    assert eventos[::-1][:5] == ["abriu", "localizacao_negada", "localizacao", "visualizou", "enviou_foto"]
    # IP: última entrada do X-Forwarded-For (o visitante não consegue forjá-la)
    assert all(a["ip"] == "203.0.113.9" for a in acessos) and acessos[0]["user_agent"] == "Celular Teste"
    loc = next(a for a in acessos if a["evento"] == "localizacao")
    assert loc["latitude"] == -27.4946 and loc["precisao"] == 12 and loc["nome"] == "João"
    fotos = admin.get("/api/arquivos", params={"entidade": "diario", "entidade_id": d["id"]}).json()
    enviada = next(f for f in fotos if f["origem"] == "link")
    assert enviada["enviado_por_nome"] == "João" and enviada["latitude"] == -27.4946
    lista = admin.get("/api/links-publicos", params={"entidade": "diario", "entidade_id": d["id"]}).json()
    assert lista[0]["fotos_recebidas"] == 1 and lista[0]["acessos"] == 1
    admin.post(f"/api/links-publicos/{link['id']}/desativar")
    assert client.get(f"/api/publico/l/{token}").status_code == 410


def test_link_visualizar_diario_e_pdf(admin, client):
    _, d = _obra_diario(admin, "Obra visualização")
    link = admin.post("/api/links-publicos", json={"tipo": "visualizar", "entidade": "diario", "entidade_id": d["id"],
                                                   "exige_localizacao": False}).json()
    token = link["url"].split("/p/")[1]
    client.get(f"/api/publico/l/{token}")
    sess = client.post(f"/api/publico/l/{token}/localizacao", json={"negada": True}).json()["sessao"]
    c = client.get(f"/api/publico/l/{token}/conteudo", headers={"X-Link-Sessao": sess}).json()
    assert c["diario"]["efetivo"][0]["nome"] == "Ari" and len(c["fotos"]) == 2 and "obra_id" not in c["diario"]
    foto = client.get(f"/api/publico/l/{token}/foto/{c['fotos'][0]['id']}", params={"s": sess})
    assert foto.headers["content-type"] == "image/jpeg"
    pdf = client.get(f"/api/publico/l/{token}/pdf", params={"s": sess})
    assert pdf.content.startswith(b"%PDF")
    assert client.post(f"/api/publico/l/{token}/fotos", data={"sessao": sess},
                       files={"arquivo": ("f.png", PNG, "image/png")}).status_code == 403


def test_link_expirado(admin, client):
    from app.core.database import SessionLocal
    from app.modules.links.models import LinkPublico

    _, d = _obra_diario(admin, "Obra expira")
    link = admin.post("/api/links-publicos", json={"tipo": "visualizar", "entidade": "diario", "entidade_id": d["id"]}).json()
    with SessionLocal() as db:
        db.get(LinkPublico, link["id"]).expira_em = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()
    assert client.get(f"/api/publico/l/{link['url'].split('/p/')[1]}").status_code == 410
    assert client.get("/api/publico/l/token-que-nao-existe").status_code == 404


def test_ip_com_proxy_confiavel(monkeypatch):
    from starlette.requests import Request

    from app.core import audit
    from app.core.config import get_settings

    req = Request({"type": "http", "headers": [(b"x-forwarded-for", b"8.8.8.8, 1.1.1.1, 10.0.0.5")], "client": ("172.18.0.3", 1)})
    assert audit.client_ip(req) == "10.0.0.5"
    monkeypatch.setattr(get_settings(), "trusted_proxies", ["10.0.0.0/8"])
    assert audit.client_ip(req) == "1.1.1.1"


def test_pdf_diario_documento_e_cartilha(admin):
    o, d = _obra_diario(admin, "Obra cartilha")
    r = admin.get(f"/api/diarios-acoes/{d['id']}/pdf")
    texto = "".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "Obra cartilha" in texto and "Ari" in texto and "Bocas de lobo" in texto and "Liberar tubos" in texto
    doc = admin.post(f"/api/diarios-acoes/{d['id']}/documento", json={}).json()
    assert doc["numero"].startswith("RDO ")
    detalhe = admin.get(f"/api/documentos/{doc['documento_id']}").json()
    assert detalhe["status"] == "emitido" and detalhe["pdf_arquivo_id"]
    assert admin.get(f"/api/documentos-acoes/{doc['documento_id']}/pdf").content.startswith(b"%PDF")
    hoje = date.today()
    for formato, larg_maior in (("livreto", True), ("a4", False)):
        c = admin.post("/api/diarios-acoes/cartilha", json={"obra_id": o["id"], "inicio": str(hoje - timedelta(days=7)),
                                                           "fim": str(hoje), "formato": formato})
        assert c.status_code == 202, c.text
        docc = admin.get(f"/api/documentos/{c.json()['documento_id']}").json()  # tarefa roda ao fim da requisição
        assert docc["status"] == "emitido", docc["variaveis"]
        pdf = PdfReader(io.BytesIO(admin.get(f"/api/documentos-acoes/{docc['id']}/pdf").content))
        p0 = pdf.pages[0].mediabox
        assert (float(p0.width) > float(p0.height)) is larg_maior
        txt = "".join(p.extract_text() for p in pdf.pages)
        assert "Obra cartilha" in txt and "Sumário" in txt
    assert admin.post("/api/diarios-acoes/cartilha", json={"obra_id": o["id"], "inicio": str(hoje),
                                                          "fim": str(hoje - timedelta(days=1))}).status_code == 422


def test_livreto_e_galeria():
    from app.modules.diario.relatorio import galeria, livreto

    assert livreto.ordem(8) == [(7, 0), (1, 6), (5, 2), (3, 4)]
    fotos = [galeria.Foto("a", 4000, 3000), galeria.Foto("b", 3000, 4000), galeria.Foto("c", 3000, 4000),
             galeria.Foto("d", 4000, 2250), galeria.Foto("e", 3000, 4000)]
    linhas = galeria.linhas(fotos, largura=180, altura_alvo=58, altura_max=95, max_por_linha=4, espaco=2.5)
    assert sum(len(g) for g, _ in linhas) == 5
    for grupo, h in linhas[:-1]:  # linhas completas preenchem a largura exata, sem distorcer
        total = sum(h * f.proporcao for f in grupo) + 2.5 * (len(grupo) - 1)
        assert abs(total - 180) < 0.01 and h <= 95


def test_localidades_ibge_com_cache(admin, monkeypatch):
    from app.modules.sistema import localidades

    chamadas = []

    def falso(url):
        chamadas.append(url)
        if url.endswith("/estados"):
            return [{"id": 42, "sigla": "SC", "nome": "Santa Catarina"}, {"id": 12, "sigla": "AC", "nome": "Acre"}]
        return [{"id": 4219150, "nome": "Vargem"}, {"id": 4205407, "nome": "Florianópolis"}]

    monkeypatch.setattr(localidades, "_buscar", falso)
    est = admin.get("/api/localidades/estados").json()
    assert [e["sigla"] for e in est] == ["AC", "SC"]
    mun = admin.get("/api/localidades/municipios", params={"uf": "sc"}).json()
    assert {"id": 4219150, "nome": "Vargem"} in mun
    admin.get("/api/localidades/municipios", params={"uf": "SC"})
    assert len(chamadas) == 2  # segunda consulta veio do cache
    assert admin.get("/api/localidades/municipios", params={"uf": "XX"}).status_code == 422


def test_clima_openweather(admin, monkeypatch):
    from app.core.imagens import fuso
    from app.modules.obras import clima

    agora = datetime.now(fuso())
    base = agora.replace(hour=0, minute=0, second=0, microsecond=0)

    def falso(db, caminho, params):
        if caminho == "/data/2.5/weather":
            return {"weather": [{"id": 803, "description": "nuvens dispersas", "icon": "04d"}], "name": "Vargem",
                    "main": {"temp": 18.4, "temp_min": 18.4, "temp_max": 18.4, "humidity": 91}, "wind": {"speed": 3.11},
                    "sys": {"sunrise": int(base.replace(hour=5, minute=24).timestamp()),
                            "sunset": int(base.replace(hour=18, minute=53).timestamp())}}
        lista = []
        for h, cod in ((9, 500), (12, 800), (15, 802)):
            t = base.replace(hour=h) + timedelta(days=1)
            lista.append({"dt": int(t.timestamp()), "weather": [{"id": cod}], "wind": {"speed": 6.0},
                          "main": {"temp_min": 12 + h / 3, "temp_max": 15 + h / 3, "humidity": 80}})
        return {"list": lista}

    monkeypatch.setattr(clima, "_get", falso)
    o, _ = _obra_diario(admin, "Obra clima")
    atual = admin.get(f"/api/clima/obra/{o['id']}").json()
    assert atual["condicao"] == "nublado" and atual["vento"] == "fraco" and atual["nascer"] == "05:24"
    amanha = (agora + timedelta(days=1)).date()
    p = admin.get(f"/api/clima/obra/{o['id']}/periodos", params={"data": str(amanha)}).json()
    assert p["manha"]["condicao"] == "chuvoso" and p["tarde"]["condicao"] == "parcialmente_nublado"
    assert p["tarde"]["vento"] == "moderado" and p["condicao_trabalho"] == "parcial"
    passado = admin.get(f"/api/clima/obra/{o['id']}/periodos", params={"data": str(agora.date() - timedelta(days=3))})
    assert passado.status_code == 409
    assert clima.condicao_por_codigo(211) == "tempestade" and clima.vento_categoria(12) == "forte"


def test_marca_dagua_texto():
    from app.core.imagens import data_abreviada

    assert data_abreviada(datetime(2026, 9, 14)) == "Seg 14 de set de 2026"
    assert data_abreviada(datetime(2026, 7, 31)) == "Sex 31 de jul de 2026"
