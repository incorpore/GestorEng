from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=200)
    codigo_totp: str | None = Field(None, max_length=10)
    dispositivo: str | None = Field(None, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class PerfilResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    email: str
    ativo: bool
    superusuario: bool
    telefone: str | None
    cargo: str | None
    trocar_senha: bool
    totp_ativo: bool
    obras_restritas: bool
    ultimo_login: datetime | None
    bloqueado_ate: datetime | None
    perfis: list[PerfilResumo] = []
    created_at: datetime | None = None


class UsuarioDetalhe(UsuarioOut):
    permissoes_diretas: list[dict] = []
    obras_ids: list[int] = []


class TokenOut(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"  # noqa: S105
    expires_in: int = 0
    refresh_token: str | None = None
    totp_required: bool = False
    usuario: UsuarioOut | None = None


class MeOut(BaseModel):
    usuario: UsuarioOut
    permissoes: list[str]
    modulos: list[dict]


class TrocarSenhaIn(BaseModel):
    senha_atual: str
    nova_senha: str = Field(max_length=200)


class TotpAtivarIn(BaseModel):
    codigo: str = Field(min_length=6, max_length=8)


class TotpDesativarIn(BaseModel):
    senha: str


class UsuarioIn(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: EmailStr
    ativo: bool = True
    superusuario: bool = False
    telefone: str | None = Field(None, max_length=30)
    cargo: str | None = Field(None, max_length=100)
    perfis_ids: list[int] = []
    obras_restritas: bool = False
    obras_ids: list[int] = []
    permissoes_diretas: list[dict] = []  # [{codigo, negar}]


class UsuarioCriarIn(UsuarioIn):
    senha: str = Field(max_length=200)


class UsuarioAtualizarIn(BaseModel):
    nome: str | None = Field(None, min_length=2, max_length=150)
    email: EmailStr | None = None
    ativo: bool | None = None
    superusuario: bool | None = None
    telefone: str | None = None
    cargo: str | None = None
    perfis_ids: list[int] | None = None
    obras_restritas: bool | None = None
    obras_ids: list[int] | None = None
    permissoes_diretas: list[dict] | None = None


class RedefinirSenhaIn(BaseModel):
    nova_senha: str = Field(max_length=200)
    exigir_troca: bool = True


class PerfilIn(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    descricao: str | None = None
    permissoes: list[str] = []


class PerfilOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    descricao: str | None
    sistema: bool
    permissoes: list[str]


class SessaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    criado_em: datetime
    expira_em: datetime
    ip: str | None
    dispositivo: str | None
