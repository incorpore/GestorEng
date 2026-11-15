from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

usuario_perfis = Table(
    "usuario_perfis",
    Base.metadata,
    Column("usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("perfil_id", ForeignKey("perfis.id", ondelete="CASCADE"), primary_key=True),
)


class Perfil(TimestampMixin, Base):
    """Perfil (papel) com um conjunto de permissões."""

    __tablename__ = "perfis"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True)
    descricao: Mapped[str | None] = mapped_column(Text)
    sistema: Mapped[bool] = mapped_column(Boolean, default=False)
    permissoes_rel: Mapped[list["PerfilPermissao"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def permissoes(self) -> list[str]:
        return sorted(p.codigo for p in self.permissoes_rel)


class PerfilPermissao(Base):
    __tablename__ = "perfil_permissoes"
    perfil_id: Mapped[int] = mapped_column(ForeignKey("perfis.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(80), primary_key=True)


class UsuarioPermissao(Base):
    """Permissões concedidas (ou negadas) diretamente a um usuário."""

    __tablename__ = "usuario_permissoes"
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(80), primary_key=True)
    negar: Mapped[bool] = mapped_column(Boolean, default=False)


class Usuario(TimestampMixin, Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    superusuario: Mapped[bool] = mapped_column(Boolean, default=False)
    telefone: Mapped[str | None] = mapped_column(String(30))
    cargo: Mapped[str | None] = mapped_column(String(100))
    trocar_senha: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(String(255))
    totp_ativo: Mapped[bool] = mapped_column(Boolean, default=False)
    tentativas_falhas: Mapped[int] = mapped_column(Integer, default=0)
    bloqueado_ate: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    # restringe o acesso a obras específicas (vazio = todas)
    obras_restritas: Mapped[bool] = mapped_column(Boolean, default=False)

    perfis: Mapped[list[Perfil]] = relationship(secondary=usuario_perfis, lazy="selectin")
    permissoes_diretas: Mapped[list[UsuarioPermissao]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    def permission_set(self) -> set[str]:
        from app.core.registry import registry

        if self.superusuario:
            return set(registry.permissions)
        perms: set[str] = set()
        for p in self.perfis:
            perms.update(pp.codigo for pp in p.permissoes_rel)
        for d in self.permissoes_diretas:
            if d.negar:
                continue
            perms.add(d.codigo)
        for d in self.permissoes_diretas:
            if d.negar:
                perms.discard(d.codigo)
        return perms


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    familia: Mapped[str] = mapped_column(String(64), index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revogado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    dispositivo: Mapped[str | None] = mapped_column(String(255))
