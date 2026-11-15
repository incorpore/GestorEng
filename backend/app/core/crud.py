"""Fábrica de rotas CRUD padronizadas (paginação, busca, filtros, permissões, auditoria e escopo)."""
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, create_model
from sqlalchemy import Select, String, and_, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import audit
from .database import get_db
from .deps import CurrentUser, require
from .scope import allowed_obra_ids

T = TypeVar("T")
RESERVED = {"q", "page", "page_size", "order"}


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def partial(model: type[BaseModel]) -> type[BaseModel]:
    """Gera um schema com todos os campos opcionais (para PATCH)."""
    fields: dict[str, Any] = {name: (f.annotation | None, None) for name, f in model.model_fields.items()}
    return create_model(f"{model.__name__}Parcial", __base__=model, **fields)


def _cast(col, raw: str):
    try:
        py = col.type.python_type
    except NotImplementedError:
        return raw
    if py is bool:
        return raw.lower() in ("1", "true", "sim", "yes")
    if py is int:
        return int(raw)
    if py in (float, Decimal):
        return Decimal(raw)
    if py is date:
        return date.fromisoformat(raw)
    if py is datetime:
        return datetime.fromisoformat(raw)
    return raw


def apply_filters(stmt: Select, model, params, allowed: Sequence[str]) -> Select:
    for key, raw in params.multi_items():
        if key in RESERVED or raw == "":
            continue
        name, _, op = key.partition("__")
        if name not in allowed:
            continue
        col = getattr(model, name)
        try:
            if op == "in":
                stmt = stmt.where(col.in_([_cast(col, v) for v in raw.split(",")]))
            elif op == "gte":
                stmt = stmt.where(col >= _cast(col, raw))
            elif op == "lte":
                stmt = stmt.where(col <= _cast(col, raw))
            elif op == "ne":
                stmt = stmt.where(col != _cast(col, raw))
            elif op == "isnull":
                stmt = stmt.where(col.is_(None) if raw.lower() == "true" else col.is_not(None))
            else:
                stmt = stmt.where(col == _cast(col, raw))
        except (ValueError, TypeError):
            raise HTTPException(422, f"Filtro inválido: {key}")
    return stmt


def apply_search(stmt: Select, model, q: str | None, fields: Sequence[str]) -> Select:
    if not q or not fields:
        return stmt
    terms = [t for t in q.strip().split() if t][:6]
    for t in terms:
        like = f"%{t}%"
        stmt = stmt.where(or_(*[cast(getattr(model, f), String).ilike(like) for f in fields]))
    return stmt


def apply_order(stmt: Select, model, order: str | None, default: str) -> Select:
    cols = model.__table__.columns.keys()
    for part in (order or default).split(","):
        part = part.strip()
        desc = part.startswith("-")
        name = part.lstrip("-")
        if name in cols:
            col = getattr(model, name)
            stmt = stmt.order_by(col.desc().nulls_last() if desc else col.asc())
    return stmt


@dataclass
class Crud:
    model: Any
    schema_in: type[BaseModel]
    schema_out: type[BaseModel]
    perm: str
    entity: str
    search: Sequence[str] = ()
    filters: Sequence[str] = ()
    order: str = "-id"
    obra_field: str | None = None  # campo que liga o registro a uma obra (escopo de acesso)
    validate: Callable[[Session, dict, Any, CurrentUser], None] | None = None
    after_save: Callable[[Session, Any, CurrentUser], None] | None = None
    base_query: Callable[[Session, CurrentUser], Select] | None = None
    extra_routes: list[Callable[[APIRouter], None]] = field(default_factory=list)
    readonly: bool = False
    allow_create: bool = True
    # relacionamentos 1:N gravados junto com o registro pai: nome_do_campo -> modelo filho
    children: dict[str, Any] = field(default_factory=dict)
    # oculta campos sensíveis para quem não tem a permissão: (codigo_permissao, {campos})
    redact: tuple[str, set[str]] | None = None

    def out(self, cu: CurrentUser, obj):
        if not self.redact or cu.has(self.redact[0]):
            return obj
        data = self.schema_out.model_validate(obj).model_dump()
        for f in self.redact[1]:
            if f in data:
                data[f] = None
        return data

    def _pop_children(self, data: dict) -> dict:
        return {k: data.pop(k) for k in list(self.children) if k in data}

    def _set_children(self, obj, kids: dict) -> None:
        for name, rows in kids.items():
            cmodel = self.children[name]
            setattr(obj, name, [cmodel(**{k: v for k, v in r.items() if k != "id"}) for r in (rows or [])])

    def scoped(self, db: Session, cu: CurrentUser, stmt: Select) -> Select:
        if self.obra_field:
            ids = allowed_obra_ids(db, cu)
            if ids is not None:
                stmt = stmt.where(getattr(self.model, self.obra_field).in_(ids or [-1]))
        return stmt

    def check_obra(self, db: Session, cu: CurrentUser, obra_id) -> None:
        if not self.obra_field or obra_id is None:
            return
        ids = allowed_obra_ids(db, cu)
        if ids is not None and obra_id not in ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem acesso a esta obra")

    def get_or_404(self, db: Session, cu: CurrentUser, obj_id: int):
        obj = db.get(self.model, obj_id)
        if obj is None:
            raise HTTPException(404, "Registro não encontrado")
        if self.obra_field:
            self.check_obra(db, cu, getattr(obj, self.obra_field))
        return obj

    def router(self, prefix: str, tags: list[str] | None = None) -> APIRouter:
        r = APIRouter(prefix=prefix, tags=tags or [self.entity])
        model, out, perm = self.model, self.schema_out, self.perm
        upd = partial(self.schema_in)
        allowed_filters = list(self.filters) + ["id"]

        @r.get("", response_model=Page[out])
        def listar(
            request: Request,
            q: str | None = None,
            page: int = Query(1, ge=1),
            page_size: int = Query(25, ge=1, le=500),
            order: str | None = None,
            db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require(f"{perm}.ver")),
        ):
            stmt = self.base_query(db, cu) if self.base_query else select(model)
            stmt = self.scoped(db, cu, stmt)
            stmt = apply_filters(stmt, model, request.query_params, allowed_filters)
            stmt = apply_search(stmt, model, q, self.search)
            total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
            stmt = apply_order(stmt, model, order, self.order).offset((page - 1) * page_size).limit(page_size)
            items = [self.out(cu, o) for o in db.scalars(stmt).unique().all()]
            return {"items": items, "total": total, "page": page, "page_size": page_size}

        @r.get("/{obj_id}", response_model=out)
        def obter(obj_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(require(f"{perm}.ver"))):
            return self.out(cu, self.get_or_404(db, cu, obj_id))

        for extra in self.extra_routes:
            extra(r)

        if self.readonly:
            return r

        @r.post("", response_model=out, status_code=201, include_in_schema=self.allow_create)
        def criar(
            payload: self.schema_in,  # type: ignore[valid-type]
            request: Request,
            db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require(f"{perm}.criar")),
        ):
            if not self.allow_create:
                raise HTTPException(405, "Criação direta não permitida")
            data = payload.model_dump()
            if self.obra_field:
                self.check_obra(db, cu, data.get(self.obra_field))
            if self.validate:
                self.validate(db, data, None, cu)
            kids = self._pop_children(data)
            obj = model(**data)
            self._set_children(obj, kids)
            db.add(obj)
            self._commit(db, obj, cu, "criar", request)
            return self.out(cu, obj)

        @r.patch("/{obj_id}", response_model=out)
        def atualizar(
            obj_id: int,
            payload: upd,  # type: ignore[valid-type]
            request: Request,
            db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require(f"{perm}.editar")),
        ):
            obj = self.get_or_404(db, cu, obj_id)
            data = payload.model_dump(exclude_unset=True)
            if self.obra_field and self.obra_field in data:
                self.check_obra(db, cu, data[self.obra_field])
            if self.validate:
                self.validate(db, data, obj, cu)
            before = audit.snapshot(obj)
            kids = self._pop_children(data)
            for k, v in data.items():
                setattr(obj, k, v)
            self._set_children(obj, kids)
            changes = {k: [before.get(k), audit._jsonable(getattr(obj, k))] for k in data if k in before}
            changes.update({k: "alterado" for k in kids})
            self._commit(db, obj, cu, "editar", request, changes)
            return self.out(cu, obj)

        @r.delete("/{obj_id}", status_code=204)
        def excluir(
            obj_id: int,
            request: Request,
            db: Session = Depends(get_db),
            cu: CurrentUser = Depends(require(f"{perm}.excluir")),
        ):
            obj = self.get_or_404(db, cu, obj_id)
            snap = audit.snapshot(obj)
            db.delete(obj)
            try:
                audit.log(db, user_id=cu.id, action="excluir", entity=self.entity, entity_id=obj_id, data=snap, request=request)
                db.commit()
            except IntegrityError:
                db.rollback()
                raise HTTPException(409, "Registro em uso por outros cadastros; não pode ser excluído")

        return r

    def _commit(self, db: Session, obj, cu: CurrentUser, action: str, request: Request, data=None):
        try:
            db.flush()
            if self.after_save:
                self.after_save(db, obj, cu)
            audit.log(db, user_id=cu.id, action=action, entity=self.entity, entity_id=obj.id,
                      data=data if data is not None else audit.snapshot(obj), request=request)
            db.commit()
        except IntegrityError as e:
            db.rollback()
            msg = str(e.orig).lower()
            if "unique" in msg or "duplicate" in msg:
                raise HTTPException(409, "Já existe um registro com estes dados (valor duplicado)")
            if "foreign key" in msg:
                raise HTTPException(422, "Referência inválida para outro cadastro")
            raise HTTPException(422, "Dados inválidos")
        db.refresh(obj)


def and_all(*conds):
    return and_(*[c for c in conds if c is not None])
