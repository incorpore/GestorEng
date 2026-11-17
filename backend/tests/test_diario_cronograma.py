from datetime import date, timedelta


def _obra(admin):
    return admin.post("/api/obras", json={"nome": "Vargem - Rua do cemitério", "status": "em_andamento",
                                          "latitude": "-27.4946870", "longitude": "-50.9796880"}).json()


def test_cronograma_e_avanco_pelo_diario(admin):
    o = _obra(admin)
    hoje = date.today()
    s1 = admin.post("/api/servicos-obra", json={"obra_id": o["id"], "descricao": "Bocas de lobo", "local": "Rua de acesso",
                                               "inicio": str(hoje - timedelta(days=10)), "fim": str(hoje + timedelta(days=20))}).json()
    assert s1["duracao_dias"] == 31 and s1["situacao"] == "em_andamento"
    assert admin.post("/api/servicos-obra", json={"obra_id": o["id"], "descricao": "X", "inicio": str(hoje),
                                                 "fim": str(hoje - timedelta(days=1))}).status_code == 422
    d1 = admin.post("/api/diarios", json={
        "obra_id": o["id"], "data": str(hoje - timedelta(days=2)),
        "efetivo": [{"nome": "Ari", "funcao": "Servente", "horas": 8}, {"nome": "Rodrigo", "funcao": "Servente", "horas": 8}],
        "atividades": [{"servico_id": s1["id"], "descricao": "Bocas de lobo", "local": "Rua de acesso", "percentual": 30}],
        "visitas_lista": [{"visitante": "Eng. Jorge Fernando", "empresa": "Velmont"}],
        "pendencias": [{"descricao": "Liberar tubos com a prefeitura"}, {"descricao": "Comprar cimento", "resolvida": True}],
        "clima_detalhe": {"manha": {"condicao": "nublado", "temp_min": 13.65, "temp_max": 20.62, "umidade": 85,
                                    "vento": "sem_vento"}},
    })
    assert d1.status_code == 201, d1.text
    d1 = d1.json()
    assert d1["clima_manha"] == "nublado" and d1["total_efetivo"] == 2 and d1["pendencias_abertas"] == 1
    assert all(p["id"] for p in d1["pendencias"]) and d1["pendencias"][1]["resolvida_em"] == str(hoje - timedelta(days=2))
    assert admin.get(f"/api/servicos-obra/{s1['id']}").json()["percentual"] == 30

    # novo diário: copia equipe, serviço em andamento e SOMENTE pendências não resolvidas
    m = admin.get("/api/diarios-acoes/modelo", params={"obra_id": o["id"], "data": str(hoje)}).json()
    assert m["origem"]["id"] == d1["id"] and len(m["efetivo"]) == 2
    assert [p["descricao"] for p in m["pendencias"]] == ["Liberar tubos com a prefeitura"]
    assert m["pendencias"][0]["id"] == d1["pendencias"][0]["id"]
    assert [a["servico_id"] for a in m["atividades"]] == [s1["id"]]

    pend = dict(m["pendencias"][0], resolvida=True)
    d2 = admin.post("/api/diarios", json={"obra_id": o["id"], "data": str(hoje), "efetivo": m["efetivo"],
                                          "atividades": [dict(m["atividades"][0], percentual=50)], "pendencias": [pend]}).json()
    assert d2["pendencias_abertas"] == 0 and d2["pendencias"][0]["origem_data"] == str(hoje - timedelta(days=2))
    assert admin.get(f"/api/servicos-obra/{s1['id']}").json()["percentual"] == 50
    resumo = admin.get(f"/api/obras/{o['id']}/resumo").json()
    assert resumo["pendencias"] == [] and resumo["avanco_cronograma"] == 50

    # serviço concluído não é copiado para o próximo diário
    admin.patch(f"/api/diarios/{d2['id']}", json={"atividades": [dict(m["atividades"][0], percentual=100)]})
    m2 = admin.get("/api/diarios-acoes/modelo", params={"obra_id": o["id"], "data": str(hoje + timedelta(days=1))}).json()
    assert m2["atividades"] == [] and m2["pendencias"] == []


def test_diario_equipe_exige_nome_ou_funcao(admin):
    o = _obra(admin)
    r = admin.post("/api/diarios", json={"obra_id": o["id"], "data": str(date.today()), "efetivo": [{"horas": 8}]})
    assert r.status_code == 422


def test_diario_antigo_continua_valido(admin):
    o = _obra(admin)
    r = admin.post("/api/diarios", json={"obra_id": o["id"], "data": str(date.today() - timedelta(days=40)),
                                         "clima_manha": "bom", "efetivo": [{"funcao": "Pedreiro", "quantidade": 3}]})
    assert r.status_code == 201 and r.json()["total_efetivo"] == 3
