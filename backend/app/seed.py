"""Dados iniciais: perfis padrão, administrador, categorias financeiras e modelos de documentos."""
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.registry import registry
from app.core.security import hash_password, validate_password_strength
from app.modules import load_modules

log = logging.getLogger("seed")


def _perms(*prefixes: str, actions=("ver", "criar", "editar", "excluir")) -> set[str]:
    return {f"{p}.{a}" for p in prefixes for a in actions} & set(registry.permissions)


def default_roles() -> dict[str, tuple[str, set[str]]]:
    allp = set(registry.permissions)
    leitura = {c for c in allp if c.endswith(".ver") and c not in {"auditoria.ver"}}
    return {
        "Administrador": ("Acesso total ao sistema", allp),
        "Engenheiro": ("Obras, diários, medições, orçamentos, documentos e licitações",
                       _perms("obras", "diario", "orcamentos", "documentos", "licitacoes", "cadastros", "apontamentos")
                       | ({"diario.fechar", "documentos.emitir", "documentos.assinar", "obras.aprovar_medicao",
                           "modelos.ver", "ia.usar", "funcionarios.ver", "frota.ver", "inventario.ver"} & allp)),
        "Financeiro": ("Financeiro, cadastros e folha", _perms("financeiro", "cadastros", "apontamentos")
                       | ({"financeiro.baixar", "funcionarios.ver", "funcionarios.ver_salarios", "obras.ver",
                           "documentos.ver", "documentos.criar", "documentos.emitir", "modelos.ver"} & allp)),
        "Encarregado de obra": ("Diário de obra, apontamentos e almoxarifado da obra",
                                _perms("diario", actions=("ver", "criar", "editar"))
                                | _perms("apontamentos", actions=("ver", "criar", "editar"))
                                | ({"funcionarios.ver", "obras.ver", "inventario.ver", "inventario.criar", "frota.ver",
                                    "frota.criar"} & allp)),
        "Somente leitura": ("Visualiza todos os módulos, sem alterar", leitura),
    }


def run() -> None:
    from app.modules.auth.models import Perfil, PerfilPermissao, Usuario
    from app.modules.documentos.models import ModeloDocumento
    from app.modules.documentos.seeds import MODELOS
    from app.modules.financeiro.models import CategoriaFinanceira

    load_modules() if not registry.modules else None
    s = get_settings()
    with SessionLocal() as db:
        for nome, (desc, perms) in default_roles().items():
            p = db.scalar(select(Perfil).where(Perfil.nome == nome))
            if p is None:
                db.add(Perfil(nome=nome, descricao=desc, sistema=True,
                              permissoes_rel=[PerfilPermissao(codigo=c) for c in sorted(perms)]))
            elif nome == "Administrador":
                # mantém o perfil administrador sempre com todas as permissões (inclusive de módulos novos)
                faltando = perms - set(p.permissoes)
                p.permissoes_rel += [PerfilPermissao(codigo=c) for c in sorted(faltando)]
        db.flush()
        if db.scalar(select(Usuario.id).limit(1)) is None:
            if not s.admin_email or not s.admin_password:
                log.warning("Nenhum usuário existe. Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar o administrador.")
            else:
                if err := validate_password_strength(s.admin_password):
                    raise SystemExit(f"ADMIN_PASSWORD fraca: {err}")
                db.add(Usuario(nome=s.admin_name, email=s.admin_email.lower(), password_hash=hash_password(s.admin_password),
                               superusuario=True, trocar_senha=False))
                log.info("Administrador %s criado", s.admin_email)
        if db.scalar(select(CategoriaFinanceira.id).limit(1)) is None:
            for tipo, grupo, nome in [
                ("receita", "Obras", "Medições"), ("receita", "Obras", "Adiantamentos de contrato"),
                ("receita", "Outras", "Outras receitas"),
                ("despesa", "Obra", "Materiais"), ("despesa", "Obra", "Mão de obra"),
                ("despesa", "Obra", "Locação de equipamentos"), ("despesa", "Obra", "Serviços de terceiros"),
                ("despesa", "Frota", "Combustível"), ("despesa", "Frota", "Manutenção de frota"),
                ("despesa", "Administrativo", "Impostos e taxas"), ("despesa", "Administrativo", "Folha administrativa"),
                ("despesa", "Administrativo", "Aluguel e utilidades"), ("despesa", "Licitações", "Garantias e cauções"),
            ]:
                db.add(CategoriaFinanceira(tipo=tipo, grupo=grupo, nome=nome))
        if db.scalar(select(ModeloDocumento.id).limit(1)) is None:
            for m in MODELOS:
                db.add(ModeloDocumento(**m))
        db.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
