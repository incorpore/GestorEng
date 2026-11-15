"""Registro de módulos.

Cada módulo do sistema declara um ``ModuleDef`` com suas permissões e rotas.
Para adicionar uma nova funcionalidade basta criar um pacote em ``app/modules``
expondo ``module = ModuleDef(...)`` e incluí-lo em ``app/modules/__init__.py``.
"""
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter

ACTIONS = {"ver": "Visualizar", "criar": "Criar", "editar": "Editar", "excluir": "Excluir"}


@dataclass(frozen=True)
class Permission:
    code: str
    label: str
    module: str


@dataclass
class ModuleDef:
    key: str
    label: str
    icon: str = "box"
    order: int = 100
    core: bool = False  # módulos core não podem ser desabilitados
    routers: list[APIRouter] = field(default_factory=list)
    permissions: list[Permission] = field(default_factory=list)
    # entidades que aceitam anexos: nome_entidade -> prefixo de permissão
    attachable: dict[str, str] = field(default_factory=dict)
    # entidades disponíveis como contexto de documentos: nome -> (rótulo, modelo SQLAlchemy, permissão exigida)
    template_entities: dict[str, tuple[str, Any, str]] = field(default_factory=dict)

    def crud_permissions(self, prefix: str | None = None, label: str | None = None, extra: dict[str, str] | None = None):
        prefix = prefix or self.key
        label = label or self.label
        for action, alabel in ACTIONS.items():
            self.permissions.append(Permission(f"{prefix}.{action}", f"{label}: {alabel}", self.key))
        for code, plabel in (extra or {}).items():
            self.permissions.append(Permission(f"{prefix}.{code}", f"{label}: {plabel}", self.key))
        return self


class Registry:
    def __init__(self) -> None:
        self.modules: dict[str, ModuleDef] = {}

    def register(self, module: ModuleDef) -> None:
        self.modules[module.key] = module

    @property
    def permissions(self) -> dict[str, Permission]:
        return {p.code: p for m in self.modules.values() for p in m.permissions}

    @property
    def template_entities(self) -> dict[str, tuple[str, Any, str]]:
        out: dict = {}
        for m in self.modules.values():
            out.update(m.template_entities)
        return out

    @property
    def attachable(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for m in self.modules.values():
            out.update(m.attachable)
        return out


registry = Registry()
