"""Motor de variáveis {{ ... }} para documentos (Jinja2 em sandbox, com autoescape)."""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from jinja2 import ChainableUndefined, StrictUndefined, TemplateSyntaxError
from jinja2.exceptions import SecurityError, UndefinedError
from jinja2.sandbox import ImmutableSandboxedEnvironment
from num2words import num2words
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]


def _dec(v) -> Decimal:
    if v is None or v == "":
        return Decimal(0)
    try:
        return Decimal(str(v))
    except InvalidOperation:
        return Decimal(0)


def f_numero(v, casas: int = 2) -> str:
    s = f"{_dec(v):,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def f_moeda(v) -> str:
    d = _dec(v)
    return ("-R$ " if d < 0 else "R$ ") + f_numero(abs(d), 2)


def _to_date(v):
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return v
    if isinstance(v, str) and v:
        try:
            return datetime.fromisoformat(v)
        except ValueError:
            return None
    return None


def f_data(v, fmt: str = "%d/%m/%Y") -> str:
    d = _to_date(v)
    return d.strftime(fmt) if d else ""


def f_data_hora(v) -> str:
    return f_data(v, "%d/%m/%Y %H:%M")


def f_data_extenso(v) -> str:
    d = _to_date(v)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}" if d else ""


def f_dia_semana(v) -> str:
    d = _to_date(v)
    return DIAS[d.weekday()] if d else ""


def f_mes_extenso(v) -> str:
    d = _to_date(v)
    return MESES[d.month - 1] if d else ""


def f_extenso(v) -> str:
    """Valor monetário por extenso: 'mil e duzentos reais e cinquenta centavos'."""
    try:
        return num2words(float(_dec(v)), lang="pt_BR", to="currency")
    except (NotImplementedError, OverflowError, ValueError):
        return ""


def f_extenso_numero(v) -> str:
    try:
        return num2words(_dec(v), lang="pt_BR")
    except (NotImplementedError, OverflowError, ValueError):
        return ""


def f_documento(v) -> str:
    """Formata CPF/CNPJ."""
    d = "".join(c for c in str(v or "") if c.isdigit())
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return str(v or "")


def f_percentual(v, casas: int = 2) -> str:
    return f_numero(v, casas) + "%"


FILTERS = {
    "moeda": f_moeda, "numero": f_numero, "data": f_data, "data_hora": f_data_hora, "data_extenso": f_data_extenso,
    "dia_semana": f_dia_semana, "mes_extenso": f_mes_extenso, "extenso": f_extenso, "extenso_numero": f_extenso_numero,
    "cpf_cnpj": f_documento, "percentual": f_percentual,
}


class SoftUndefined(ChainableUndefined):
    """Variável inexistente vira texto vazio (evita quebrar o documento), inclusive em cadeia (a.b.c)."""


def make_env(strict: bool = False) -> ImmutableSandboxedEnvironment:
    from .helpers import HELPERS

    env = ImmutableSandboxedEnvironment(autoescape=True, undefined=StrictUndefined if strict else SoftUndefined,
                                        trim_blocks=True, lstrip_blocks=True)
    env.filters.update(FILTERS)
    env.globals.update(HELPERS)
    return env


class RenderError(Exception):
    pass


def render(template: str, context: dict, strict: bool = False) -> str:
    env = make_env(strict)
    try:
        return env.from_string(template).render(**context)
    except TemplateSyntaxError as e:
        raise RenderError(f"Erro de sintaxe na linha {e.lineno}: {e.message}")
    except UndefinedError as e:
        raise RenderError(f"Variável inexistente: {e.message}")
    except SecurityError:
        raise RenderError("Operação não permitida no modelo")
    except Exception as e:  # noqa: BLE001
        raise RenderError(f"Falha ao processar o modelo: {e.__class__.__name__}")


# ---------------- Contexto ----------------
def _jsonish(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def obj_to_ctx(obj, depth: int = 0) -> dict:
    """Converte um registro em dicionário: colunas + propriedades + relacionamentos (1 nível)."""
    if obj is None:
        return {}
    mapper = sa_inspect(obj).mapper
    out = {c.key: _jsonish(getattr(obj, c.key)) for c in mapper.column_attrs
           if c.key not in {"password_hash", "totp_secret", "segredo_cifrado"}}
    for name in dir(type(obj)):
        attr = getattr(type(obj), name, None)
        if isinstance(attr, property) and not name.startswith("_"):
            try:
                out[name] = _jsonish(getattr(obj, name))
            except Exception:  # noqa: BLE001,S112
                continue
    if depth < 1:
        for rel in mapper.relationships:
            val = getattr(obj, rel.key)
            if rel.uselist:
                out[rel.key] = [obj_to_ctx(v, depth + 1) for v in (val or [])]
            else:
                out[rel.key] = obj_to_ctx(val, depth + 1) if val is not None else {}
    return out


def build_context(db: Session, *, entidade: str | None, entidade_id: int | None, documento=None, usuario=None,
                  extras: dict | None = None) -> dict:
    from app.core.registry import registry
    from app.modules.sistema.module import logo_data_uri
    from app.modules.sistema.service import get_config

    agora = datetime.now()
    empresa = get_config(db, "empresa")
    empresa["logo"] = logo_data_uri(db) or ""
    ctx: dict = {
        "empresa": empresa,
        "hoje": documento.data_emissao if documento else agora.date(),
        "agora": agora,
        "cidade_emissao": get_config(db, "documentos").get("cidade_emissao") or empresa.get("cidade") or "",
        "usuario": {"nome": usuario.nome, "email": usuario.email, "cargo": usuario.cargo} if usuario else {},
        "documento": {"numero": documento.numero, "titulo": documento.titulo, "data": documento.data_emissao,
                      "destinatario": documento.destinatario} if documento else {},
        "var": extras or {},
    }
    if entidade and entidade_id:
        info = registry.template_entities.get(entidade)
        if info:
            obj = db.get(info[1], entidade_id)
            data = obj_to_ctx(obj)
            ctx[entidade] = data
            # atalhos úteis: obra/cliente a partir da entidade principal
            if "obra" in data and isinstance(data["obra"], dict) and "obra" not in ctx:
                ctx["obra"] = data["obra"]
            if entidade == "medicao" and obj is not None and obj.obra and obj.obra.cliente:
                ctx["cliente"] = obj_to_ctx(obj.obra.cliente)
            if "cliente" in data and isinstance(data["cliente"], dict) and "cliente" not in ctx:
                ctx["cliente"] = data["cliente"]
    return ctx


def variables_catalog() -> dict:
    """Lista de variáveis disponíveis por entidade, para o seletor do editor."""
    from app.core.registry import registry

    base = {
        "geral": [
            ("hoje", "Data de emissão"), ("hoje|data_extenso", "Data por extenso"), ("cidade_emissao", "Cidade de emissão"),
            ("documento.numero", "Número do documento"), ("documento.destinatario", "Destinatário"),
            ("usuario.nome", "Usuário emissor"), ("usuario.cargo", "Cargo do emissor"),
        ],
        "empresa": [(f"empresa.{k}", k.replace("_", " ").capitalize())
                    for k in ("razao_social", "nome_fantasia", "cnpj", "endereco", "bairro", "cidade", "uf", "cep",
                              "telefone", "email", "site", "responsavel", "cargo_responsavel", "crea")],
    }
    for ent, (_label, model, _perm) in registry.template_entities.items():
        mapper = sa_inspect(model)
        cols = [(f"{ent}.{c.key}", c.key.replace("_", " ")) for c in mapper.column_attrs
                if not c.key.endswith("_id") and c.key not in {"id", "created_at", "updated_at"}]
        props = [(f"{ent}.{n}", n.replace("_", " ")) for n in dir(model)
                 if isinstance(getattr(model, n, None), property) and not n.startswith("_")]
        base[ent] = cols + props
        rels = {rel.key: rel.mapper.class_ for rel in mapper.relationships}
        if "itens" in rels:
            ic = sa_inspect(rels["itens"])
            base[ent].append((f"{ent}.itens", f"lista de itens — use {{% for i in {ent}.itens %}}"))
            base[ent] += [(f"i.{c.key}", f"item: {c.key}") for c in ic.column_attrs
                          if not c.key.endswith("_id") and c.key != "id"]
        base[ent] = base[ent]
    return {k: [{"chave": a, "descricao": b} for a, b in v] for k, v in base.items()} | {
        "_filtros": [{"chave": k, "descricao": (f.__doc__ or k).strip()} for k, f in FILTERS.items()],
        "_funcoes": [{"chave": k, "descricao": (f.__doc__ or k).strip().splitlines()[0]} for k, f in _helpers().items()],
        "_rotulos": {ent: info[0] for ent, info in registry.template_entities.items()},
    }


def _helpers():
    from .helpers import HELPERS

    return HELPERS
