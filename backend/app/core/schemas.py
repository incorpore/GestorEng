from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

Money = Annotated[Decimal, Field(max_digits=16, decimal_places=2), PlainSerializer(float, return_type=float, when_used="json")]
Qty = Annotated[Decimal, Field(max_digits=16, decimal_places=4), PlainSerializer(float, return_type=float, when_used="json")]
Pct = Annotated[Decimal, Field(ge=0, le=1000, max_digits=8, decimal_places=4), PlainSerializer(float, return_type=float, when_used="json")]


class In(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
