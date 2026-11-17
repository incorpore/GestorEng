"""Lista de módulos do sistema.

Para adicionar um novo módulo:
  1. crie ``app/modules/<nome>/`` com ``models.py`` e ``module.py`` (expondo ``module = ModuleDef(...)``);
  2. adicione o caminho em ``MODULES`` abaixo;
  3. gere a migração: ``alembic revision --autogenerate -m "<nome>"``;
  4. no frontend, crie ``src/modules/<nome>/index.tsx`` e registre em ``src/modules/index.ts``.
"""
from importlib import import_module

from app.core.config import get_settings
from app.core.registry import ModuleDef, registry

MODULES = [
    "app.modules.auth",
    "app.modules.sistema",
    "app.modules.cadastros",
    "app.modules.obras",
    "app.modules.licitacoes",
    "app.modules.orcamentos",
    "app.modules.diario",
    "app.modules.financeiro",
    "app.modules.documentos",
    "app.modules.frota",
    "app.modules.funcionarios",
    "app.modules.inventario",
    "app.modules.ia",
    "app.modules.backup",
    "app.modules.links",
    "app.modules.listas",
]


def import_models() -> None:
    """Importa todos os modelos (necessário para o metadata/Alembic)."""
    import app.core.models  # noqa: F401

    for path in MODULES:
        try:
            import_module(f"{path}.models")
        except ModuleNotFoundError as e:
            if e.name != f"{path}.models":
                raise


def load_modules() -> list[ModuleDef]:
    import_models()
    enabled = get_settings().enabled_modules
    for path in MODULES:
        mod: ModuleDef = import_module(f"{path}.module").module
        if mod.core or "*" in enabled or mod.key in enabled:
            registry.register(mod)
    return sorted(registry.modules.values(), key=lambda m: m.order)


def enabled_modules() -> list[ModuleDef]:
    """Módulos carregados e não desativados em tempo de execução (Configurações > Módulos)."""
    from app.core.database import SessionLocal
    from app.modules.sistema.service import disabled_modules

    with SessionLocal() as db:
        off = disabled_modules(db)
    return [m for m in sorted(registry.modules.values(), key=lambda m: m.order) if m.core or m.key not in off]
