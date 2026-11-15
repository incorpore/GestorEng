from decimal import Decimal

from sqlalchemy import Numeric
from sqlalchemy.orm import mapped_column

MONEY = Numeric(16, 2)
QTY = Numeric(16, 4)


def money(default=Decimal("0"), **kw):
    return mapped_column(MONEY, default=default, **kw)


def qty(default=Decimal("0"), **kw):
    return mapped_column(QTY, default=default, **kw)
