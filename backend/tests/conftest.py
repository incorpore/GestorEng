import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://postgres@127.0.0.1:5433/struvia_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdefghijklmnop")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-0123456789abcdefghij")
os.environ.setdefault("STORAGE_DIR", "/tmp/struvia-test-storage")  # noqa: S108
os.environ["ADMIN_EMAIL"] = "admin@teste.com"
os.environ["ADMIN_PASSWORD"] = "Admin@12345"
os.environ["COOKIE_SECURE"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.core.ratelimit import login_limiter, sensitive_limiter  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"email": "admin@teste.com", "senha": "Admin@12345"}


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    from app import seed

    seed.run()
    yield


@pytest.fixture(autouse=True)
def _reset_limits():
    login_limiter.hits.clear()
    sensitive_limiter.hits.clear()


@pytest.fixture()
def client():
    return TestClient(app)


def login(client, email, senha, mobile=False):
    headers = {"X-Client": "mobile"} if mobile else {}
    r = client.post("/api/auth/login", json={"email": email, "senha": senha}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def admin(client):
    tok = login(client, **ADMIN)["access_token"]
    client.headers["Authorization"] = f"Bearer {tok}"
    return client


def make_user(admin_client, email, perms=(), senha="Senha@Forte123", **extra):
    r = admin_client.post("/api/perfis", json={"nome": f"perfil-{email}", "permissoes": list(perms)})
    assert r.status_code == 201, r.text
    r = admin_client.post("/api/usuarios", json={"nome": "Usuário Teste", "email": email, "senha": senha,
                                                 "perfis_ids": [r.json()["id"]], **extra})
    assert r.status_code == 201, r.text
    return r.json()


def client_for(email, senha="Senha@Forte123"):
    c = TestClient(app)
    tok = login(c, email, senha)["access_token"]
    c.headers["Authorization"] = f"Bearer {tok}"
    return c
