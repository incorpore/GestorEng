from conftest import client_for, make_user


def test_listas_editaveis(admin):
    v = admin.get("/api/listas/forma_pagamento").json()
    assert "PIX" in v["valores"] and v["pode_adicionar"]
    assert admin.post("/api/listas/forma_pagamento", json={"valor": "  Crédito   em conta "}).json() == {"valor": "Crédito em conta", "novo": True}
    assert admin.post("/api/listas/forma_pagamento", json={"valor": "pix"}).json() == {"valor": "PIX", "novo": False}
    assert admin.post("/api/listas/forma_pagamento", json={"valor": "crédito em conta"}).json()["novo"] is False
    assert "Crédito em conta" in admin.get("/api/listas/forma_pagamento").json()["valores"]
    assert admin.get("/api/listas/nao_existe").status_code == 404
    todas = admin.get("/api/listas").json()
    item = next(x for x in todas if x["lista"] == "forma_pagamento")["personalizados"][0]
    # quem só visualiza não adiciona; quem edita o módulo adiciona
    make_user(admin, "listas-leitor@teste.com", perms=["financeiro.ver"])
    assert client_for("listas-leitor@teste.com").post("/api/listas/forma_pagamento", json={"valor": "X"}).status_code == 403
    make_user(admin, "listas-enc@teste.com", perms=["diario.criar"])
    enc = client_for("listas-enc@teste.com")
    assert enc.post("/api/listas/funcao", json={"valor": "Calceteiro"}).status_code == 201
    assert enc.delete(f"/api/listas/forma_pagamento/{item['id']}").status_code == 403
    assert admin.delete(f"/api/listas/forma_pagamento/{item['id']}").status_code == 204
