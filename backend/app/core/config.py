"""Configuração central lida de variáveis de ambiente."""
from functools import lru_cache
from typing import Annotated
from urllib.parse import quote

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GestorEng"
    environment: str = Field("production", description="production | development | test")
    # Banco: informe DATABASE_URL completa OU as variáveis POSTGRES_* (a URL é montada e a senha codificada automaticamente)
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "gestoreng"
    postgres_user: str = "gestoreng"
    postgres_password: str | None = None

    # Redis (opcional): REDIS_URL completa OU REDIS_HOST/REDIS_PASSWORD/REDIS_DB; prefixo das chaves em REDIS_PREFIX
    redis_url: str | None = None
    redis_host: str | None = None
    redis_port: int = 6379
    redis_password: str | None = None
    redis_db: int = 0
    redis_prefix: str | None = None

    # Segurança
    secret_key: str = Field(..., min_length=32, description="Chave para assinar JWT")
    encryption_key: str = Field(..., min_length=32, description="Chave para criptografar credenciais de integrações")
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    # aceitos como lista separada por vírgula ("a,b,c") ou JSON (["a","b"])
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "capacitor://localhost", "https://localhost", "http://localhost"]
    cookie_secure: bool = True

    # Primeiro administrador (criado se não houver usuários)
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Administrador"

    # Arquivos
    storage_dir: str = "/data/storage"
    max_upload_mb: int = 25

    # Módulos habilitados ("*" = todos)
    enabled_modules: Annotated[list[str], NoDecode] = ["*"]

    @field_validator("cors_origins", "enabled_modules", mode="before")
    @classmethod
    def _split(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return [str(x).strip() for x in json.loads(v)]
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @model_validator(mode="after")
    def _montar_urls(self):
        if not self.database_url:
            auth = quote(self.postgres_user, safe="")
            if self.postgres_password:
                auth += ":" + quote(self.postgres_password, safe="")
            self.database_url = (f"postgresql+psycopg://{auth}@{self.postgres_host}:{self.postgres_port}/"
                                 f"{quote(self.postgres_db, safe='')}")
        if not self.redis_url and self.redis_host:
            auth = f":{quote(self.redis_password, safe='')}@" if self.redis_password else ""
            self.redis_url = f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return self

    @property
    def is_dev(self) -> bool:
        return self.environment in ("development", "test")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
