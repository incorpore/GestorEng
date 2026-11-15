"""Configuração central lida de variáveis de ambiente."""
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GestorEng"
    environment: str = Field("production", description="production | development | test")
    database_url: str = "postgresql+psycopg://gestoreng:gestoreng@localhost:5432/gestoreng"

    # Segurança
    secret_key: str = Field(..., min_length=32, description="Chave para assinar JWT")
    encryption_key: str = Field(..., min_length=32, description="Chave para criptografar credenciais de integrações")
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    cors_origins: list[str] = ["http://localhost:5173", "capacitor://localhost", "https://localhost", "http://localhost"]
    cookie_secure: bool = True

    # Primeiro administrador (criado se não houver usuários)
    admin_email: str | None = None
    admin_password: str | None = None
    admin_name: str = "Administrador"

    # Arquivos
    storage_dir: str = "/data/storage"
    max_upload_mb: int = 25

    # Módulos habilitados ("*" = todos)
    enabled_modules: list[str] = ["*"]

    @field_validator("cors_origins", "enabled_modules", mode="before")
    @classmethod
    def _split(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @property
    def is_dev(self) -> bool:
        return self.environment in ("development", "test")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
