from app.core.registry import ModuleDef, Permission

from .admin import router as admin_router
from .router import router as auth_router

module = ModuleDef(key="admin", label="Administração", icon="shield", order=900, core=True,
                   routers=[auth_router, admin_router])
module.crud_permissions("usuarios", "Usuários")
module.crud_permissions("perfis", "Perfis de acesso")
module.permissions.append(Permission("auditoria.ver", "Auditoria: Visualizar", "admin"))
