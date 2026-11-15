from conftest import client_for, make_user


def _obra(admin, **kw):
    r = admin.post("/api/obras", json={"nome": "Pavimentação Rua A", "tipo": "licitacao", "valor_contrato": 100000,
                                       "status": "em_andamento", **kw})
    assert r.status_code == 201, r.text
    return r.json()


def test_crud_obra_busca_filtro(admin):
    o = _obra(admin, cidade="Campinas", data_inicio="2026-01-10", prazo_dias=90)
    assert o["data_prevista_fim"] == "2026-04-10"
    r = admin.get("/api/obras", params={"q": "pavimentação campinas", "status": "em_andamento"})
    assert r.status_code == 200 and r.json()["total"] >= 1
    assert admin.patch(f"/api/obras/{o['id']}", json={"progresso": 35.5}).json()["progresso"] == 35.5
    assert admin.get("/api/obras", params={"valor_contrato__gte": "abc"}).status_code in (200, 422)


def test_medicao_com_itens(admin):
    o = _obra(admin)
    payload = {"obra_id": o["id"], "data": "2026-02-01", "itens": [
        {"descricao": "Escavação", "unidade": "m3", "qtd_contratada": 100, "qtd_periodo": 40, "preco_unitario": 25.5},
        {"descricao": "Concreto", "unidade": "m3", "qtd_contratada": 10, "qtd_periodo": 5, "preco_unitario": 600},
    ]}
    m = admin.post("/api/medicoes", json=payload).json()
    assert m["numero"] == 1
    assert m["valor_periodo"] == 40 * 25.5 + 5 * 600
    prox = admin.get(f"/api/obras/{o['id']}/medicoes/proxima").json()
    assert prox["numero"] == 2 and prox["itens"][0]["qtd_anterior"] == 40
    m2 = admin.post("/api/medicoes", json={"obra_id": o["id"], "data": "2026-03-01", "itens": [
        {**prox["itens"][0], "qtd_periodo": 10}]}).json()
    assert m2["numero"] == 2 and m2["itens"][0]["qtd_acumulada"] == 50 and m2["itens"][0]["percentual"] == 50
    # atualização substitui itens
    m2 = admin.patch(f"/api/medicoes/{m2['id']}", json={"itens": []}).json()
    assert m2["itens"] == []


def test_escopo_por_obra(admin):
    o1 = _obra(admin, nome="Obra Permitida")
    o2 = _obra(admin, nome="Obra Proibida")
    make_user(admin, "escopo@teste.com", perms=["obras.ver", "diario.ver", "diario.criar"], obras_restritas=True,
              obras_ids=[o1["id"]])
    c = client_for("escopo@teste.com")
    ids = {o["id"] for o in c.get("/api/obras", params={"page_size": 500}).json()["items"]}
    assert ids == {o1["id"]}
    assert c.get(f"/api/obras/{o2['id']}").status_code == 403
    assert c.post("/api/diarios", json={"obra_id": o2["id"], "data": "2026-01-05"}).status_code == 403
    assert c.post("/api/diarios", json={"obra_id": o1["id"], "data": "2026-01-05"}).status_code == 201


def test_diario_fechar(admin):
    o = _obra(admin)
    d = admin.post("/api/diarios", json={"obra_id": o["id"], "data": "2026-01-06",
                                         "efetivo": [{"funcao": "Pedreiro", "quantidade": 3}]}).json()
    assert d["total_efetivo"] == 3 and d["numero"] == 1
    assert admin.post(f"/api/diarios-acoes/{d['id']}/fechar").json()["status"] == "fechado"
    assert admin.patch(f"/api/diarios/{d['id']}", json={"observacoes": "x"}).status_code == 409
    assert admin.post("/api/diarios", json={"obra_id": o["id"], "data": "2026-01-06"}).status_code == 409


def test_funcionarios_apontamento_e_redacao(admin):
    o = _obra(admin)
    f = admin.post("/api/funcionarios", json={"nome": "João Diarista", "vinculo": "diaria", "valor_diaria": 180,
                                              "cpf": "12345678901", "obra_id": o["id"]}).json()
    a = admin.post("/api/apontamentos", json={"funcionario_id": f["id"], "data": "2026-01-07", "diarias": 1.5}).json()
    assert a["valor"] == 270 and a["obra_id"] == o["id"]
    h = admin.post("/api/funcionarios", json={"nome": "Maria Horista", "vinculo": "horista", "valor_hora": 20}).json()
    a2 = admin.post("/api/apontamentos", json={"funcionario_id": h["id"], "data": "2026-01-07", "horas": 8,
                                               "horas_extras": 2}).json()
    assert a2["valor"] == 8 * 20 + 2 * 30
    make_user(admin, "semsalario@teste.com", perms=["funcionarios.ver", "apontamentos.ver"])
    c = client_for("semsalario@teste.com")
    item = c.get(f"/api/funcionarios/{f['id']}").json()
    assert item["valor_diaria"] is None and item["cpf"] is None and item["nome"] == "João Diarista"
    assert c.get(f"/api/apontamentos/{a['id']}").json()["valor"] is None
    folha = admin.post("/api/funcionarios-relatorios/folha", json={"inicio": "2026-01-01", "fim": "2026-01-31"}).json()
    assert folha["a_pagar"] >= 270 + 220
    r = admin.post("/api/funcionarios-relatorios/pagar", json={"apontamentos_ids": [a["id"]],
                                                               "data_pagamento": "2026-01-31"}).json()
    assert r["pagos"] == 1 and len(r["lancamentos"]) == 1
    assert admin.patch(f"/api/apontamentos/{a['id']}", json={"diarias": 2}).status_code == 409


def test_financeiro(admin):
    conta = admin.post("/api/contas-financeiras", json={"nome": "Banco X", "saldo_inicial": 1000}).json()
    lanc = admin.post("/api/lancamentos", json={"tipo": "despesa", "descricao": "Cimento", "valor": 300,
                                                "vencimento": "2026-01-10"}).json()
    r = admin.post(f"/api/financeiro/lancamentos/{lanc['id']}/baixar",
                   json={"valor": 100, "data_pagamento": "2026-01-10", "conta_id": conta["id"]}).json()
    assert r["status"] == "parcial"
    r = admin.post(f"/api/financeiro/lancamentos/{lanc['id']}/baixar",
                   json={"valor": 200, "data_pagamento": "2026-01-11"}).json()
    assert r["status"] == "pago"
    saldo = next(s for s in admin.get("/api/financeiro/saldos").json() if s["id"] == conta["id"])
    assert saldo["saldo"] == 700
    parc = admin.post("/api/financeiro/parcelado", json={"tipo": "receita", "descricao": "Contrato", "valor": 1000,
                                                         "vencimento": "2026-01-31", "parcelas": 3}).json()
    assert [p["valor"] for p in parc] == [333.33, 333.33, 333.34]
    assert parc[1]["vencimento"] == "2026-02-28"
    res = admin.get("/api/financeiro/resumo", params={"ano": 2026}).json()
    assert len(res["meses"]) == 12


def test_inventario_saldo(admin):
    loc1 = admin.post("/api/locais-estoque", json={"nome": "Almoxarifado central"}).json()
    loc2 = admin.post("/api/locais-estoque", json={"nome": "Obra A"}).json()
    item = admin.post("/api/itens-estoque", json={"nome": "Cimento CP-II 50kg", "unidade": "sc", "estoque_minimo": 20}).json()
    assert admin.post("/api/movimentacoes", json={"item_id": item["id"], "tipo": "entrada", "data": "2026-01-01",
                                                  "quantidade": 50, "custo_unitario": 35,
                                                  "destino_id": loc1["id"]}).status_code == 201
    assert admin.post("/api/movimentacoes", json={"item_id": item["id"], "tipo": "transferencia", "data": "2026-01-02",
                                                  "quantidade": 40, "origem_id": loc1["id"],
                                                  "destino_id": loc2["id"]}).status_code == 201
    r = admin.post("/api/movimentacoes", json={"item_id": item["id"], "tipo": "saida", "data": "2026-01-03",
                                               "quantidade": 11, "origem_id": loc1["id"]})
    assert r.status_code == 422
    saldos = {s["local_id"]: s["saldo"] for s in admin.get("/api/estoque/saldos").json() if s["item_id"] == item["id"]}
    assert saldos == {loc1["id"]: 10, loc2["id"]: 40}
    assert admin.get(f"/api/itens-estoque/{item['id']}").json()["custo_medio"] == 35


def test_orcamento(admin):
    o = admin.post("/api/orcamentos", json={"titulo": "Reforma", "data": "2026-03-01", "bdi": 25, "itens": [
        {"agrupador": True, "item": "1", "descricao": "Serviços preliminares"},
        {"item": "1.1", "descricao": "Limpeza", "unidade": "m2", "quantidade": 100, "preco_unitario": 10},
    ]}).json()
    assert o["custo_direto"] == 1000 and o["valor_bdi"] == 250 and o["total"] == 1250
    assert o["numero"].endswith("/2026")
    d = admin.post(f"/api/orcamentos-acoes/{o['id']}/duplicar").json()
    assert d["id"] != o["id"] and len(d["itens"]) == 2


def test_modulo_desativado(admin):
    assert admin.put("/api/configuracoes/modulos", json={"desativados": ["frota"]}).status_code == 200
    from app.modules.sistema import service

    service._cache.clear()
    assert admin.get("/api/veiculos").status_code == 404
    assert not any(m["key"] == "frota" for m in admin.get("/api/auth/me").json()["modulos"])
    admin.put("/api/configuracoes/modulos", json={"desativados": []})
    service._cache.clear()
    assert admin.get("/api/veiculos").status_code == 200


def test_anexos(admin):
    o = _obra(admin)
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
           b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82")
    r = admin.post("/api/arquivos", data={"entidade": "obra", "entidade_id": o["id"]},
                   files={"arquivo": ("foto.png", png, "image/png")})
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    link = admin.get(f"/api/arquivos/{aid}/link").json()["url"]
    assert admin.get(link).content == png
    assert admin.get(f"/api/arquivos/{aid}/conteudo", params={"t": "x"}).status_code == 401
    # executável disfarçado é rejeitado
    r = admin.post("/api/arquivos", data={"entidade": "obra", "entidade_id": o["id"]},
                   files={"arquivo": ("foto.png", b"MZ\x90\x00" + b"\x00" * 100, "image/png")})
    assert r.status_code == 415
