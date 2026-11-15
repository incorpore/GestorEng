import types
import typing
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator

Money = Annotated[Decimal, Field(max_digits=16, decimal_places=2), PlainSerializer(float, return_type=float, when_used="json")]
Qty = Annotated[Decimal, Field(max_digits=16, decimal_places=4), PlainSerializer(float, return_type=float, when_used="json")]
Pct = Annotated[Decimal, Field(ge=0, le=1000, max_digits=8, decimal_places=4), PlainSerializer(float, return_type=float, when_used="json")]


def allows_none(ann) -> bool:
    if ann is None or ann is type(None):
        return True
    origin = typing.get_origin(ann)
    if origin is Annotated:
        return allows_none(typing.get_args(ann)[0])
    if origin in (typing.Union, types.UnionType):
        return any(allows_none(a) for a in typing.get_args(ann))
    return ann is typing.Any


def non_nullable(model: type[BaseModel]) -> set[str]:
    return {n for n, f in model.model_fields.items() if not allows_none(f.annotation)}


class In(BaseModel):
    """Base de entrada: `null` em campo não-anulável é ignorado (usa o padrão / mantém o valor atual)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data):
        if isinstance(data, dict):
            nn = cls.__dict__.get("__non_nullable__")
            if nn is None:
                nn = non_nullable(cls)
            return {k: v for k, v in data.items() if not (v is None and k in nn)}
        return data


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
