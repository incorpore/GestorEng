from app.core.config import Settings

BASE = {"secret_key": "x" * 40, "encryption_key": "y" * 40}


def test_monta_urls_com_senha_especial(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    s = Settings(**BASE, postgres_host="db", postgres_user="GestorEng", postgres_password="p@ss#1:/%",
                 postgres_db="GestorEng", redis_host="redis", redis_password="r@#1", redis_db=2, _env_file=None)
    assert s.database_url == "postgresql+psycopg://GestorEng:p%40ss%231%3A%2F%25@db:5432/GestorEng"
    assert s.redis_url == "redis://:r%40%231@redis:6379/2"


def test_url_explicita_tem_prioridade(monkeypatch):
    s = Settings(**BASE, database_url="postgresql+psycopg://a:b@h/x", postgres_password="ignorada", _env_file=None)
    assert s.database_url == "postgresql+psycopg://a:b@h/x" and s.redis_url is None


def test_pg_dump_recebe_senha_decodificada(monkeypatch):
    from app.core import config
    from app.modules.backup import service

    monkeypatch.setattr(config.get_settings(), "database_url", "postgresql+psycopg://GestorEng:p%40ss%231@db:5432/GestorEng")
    args, env = service._pg_env()
    assert env["PGPASSWORD"] == "p@ss#1" and args[args.index("-U") + 1] == "GestorEng"
