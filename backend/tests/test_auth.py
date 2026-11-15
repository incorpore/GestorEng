from conftest import ADMIN, client_for, login, make_user


def test_login_e_me(admin):
    r = admin.get("/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["usuario"]["superusuario"] is True
    assert "obras.ver" in data["permissoes"]
    assert any(m["key"] == "obras" for m in data["modulos"])


def test_login_invalido(client):
    r = client.post("/api/auth/login", json={"email": ADMIN["email"], "senha": "errada"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"email": "naoexiste@x.com", "senha": "errada"})
    assert r.status_code == 401


def test_sem_token(client):
    assert client.get("/api/obras").status_code == 401
    client.headers["Authorization"] = "Bearer invalido"
    assert client.get("/api/obras").status_code == 401


def test_refresh_rotacao_e_reuso(client):
    data = login(client, **ADMIN, mobile=True)
    rt = data["refresh_token"]
    h = {"X-Client": "mobile"}
    r1 = client.post("/api/auth/refresh", json={"refresh_token": rt}, headers=h)
    assert r1.status_code == 200
    novo = r1.json()["refresh_token"]
    assert novo != rt
    # reuso do token antigo revoga a família inteira
    assert client.post("/api/auth/refresh", json={"refresh_token": rt}, headers=h).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": novo}, headers=h).status_code == 401


def test_refresh_por_cookie_web(client):
    r = client.post("/api/auth/login", json=ADMIN)
    assert "refresh_token" not in r.json() or r.json()["refresh_token"] is None
    assert "ge_refresh" in r.cookies
    r2 = client.post("/api/auth/refresh")
    assert r2.status_code == 200


def test_bloqueio_por_tentativas(admin):
    make_user(admin, "bloqueio@teste.com")
    from app.core.ratelimit import login_limiter

    for _ in range(5):
        login_limiter.hits.clear()
        admin.post("/api/auth/login", json={"email": "bloqueio@teste.com", "senha": "errada"})
    r = admin.post("/api/auth/login", json={"email": "bloqueio@teste.com", "senha": "Senha@Forte123"})
    assert r.status_code == 423


def test_permissoes_e_escalonamento(admin):
    make_user(admin, "leitor@teste.com", perms=["obras.ver", "usuarios.ver", "usuarios.editar", "perfis.criar"])
    c = client_for("leitor@teste.com")
    assert c.get("/api/obras").status_code == 200
    assert c.post("/api/obras", json={"nome": "X"}).status_code == 403
    assert c.get("/api/lancamentos").status_code == 403
    # não pode criar perfil com permissões que não possui
    r = c.post("/api/perfis", json={"nome": "hack", "permissoes": ["financeiro.ver"]})
    assert r.status_code == 403
    # não pode se tornar superusuário
    me = c.get("/api/auth/me").json()["usuario"]
    assert c.patch(f"/api/usuarios/{me['id']}", json={"superusuario": True}).status_code in (400, 403)


def test_permissao_negada_direta(admin):
    u = make_user(admin, "negado@teste.com", perms=["obras.ver", "obras.criar"])
    admin.patch(f"/api/usuarios/{u['id']}", json={"permissoes_diretas": [{"codigo": "obras.criar", "negar": True}]})
    c = client_for("negado@teste.com")
    assert c.post("/api/obras", json={"nome": "Teste"}).status_code == 403


def test_senha_fraca(admin):
    r = admin.post("/api/usuarios", json={"nome": "Fraco", "email": "fraco@teste.com", "senha": "123"})
    assert r.status_code == 422


def test_desativar_revoga_acesso(admin):
    u = make_user(admin, "desativar@teste.com", perms=["obras.ver"])
    c = client_for("desativar@teste.com")
    assert c.get("/api/obras").status_code == 200
    admin.delete(f"/api/usuarios/{u['id']}")
    assert c.get("/api/obras").status_code == 401


def test_totp(admin):
    import pyotp

    make_user(admin, "totp@teste.com", perms=["obras.ver"])
    c = client_for("totp@teste.com")
    secret = c.post("/api/auth/2fa/configurar").json()["secret"]
    assert c.post("/api/auth/2fa/ativar", json={"codigo": pyotp.TOTP(secret).now()}).status_code == 204
    r = c.post("/api/auth/login", json={"email": "totp@teste.com", "senha": "Senha@Forte123"})
    assert r.json()["totp_required"] is True and r.json()["access_token"] is None
    r = c.post("/api/auth/login", json={"email": "totp@teste.com", "senha": "Senha@Forte123", "codigo_totp": "000000"})
    assert r.status_code == 401
    r = c.post("/api/auth/login", json={"email": "totp@teste.com", "senha": "Senha@Forte123",
                                        "codigo_totp": pyotp.TOTP(secret).now()})
    assert r.status_code == 200 and r.json()["access_token"]


def test_auditoria(admin):
    admin.post("/api/obras", json={"nome": "Obra auditada"})
    r = admin.get("/api/auditoria", params={"entity": "obra"})
    assert r.status_code == 200
    assert any(i["action"] == "criar" for i in r.json()["items"])
