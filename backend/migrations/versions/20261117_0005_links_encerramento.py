"""links publicos: encerramento (finalizado pelo visitante, desativado ou excluido)

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-17 11:00:00
"""
import sqlalchemy as sa
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('links_publicos', sa.Column('encerrado_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('links_publicos', sa.Column('encerramento', sa.String(length=20), nullable=True))
    op.execute("UPDATE links_publicos SET encerramento = 'desativado' WHERE ativo = false")


def downgrade() -> None:
    op.drop_column('links_publicos', 'encerramento')
    op.drop_column('links_publicos', 'encerrado_em')
