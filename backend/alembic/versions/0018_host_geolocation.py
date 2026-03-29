"""host geolocation

Revision ID: 0018_host_geolocation
Revises: 0017_service_classify
Create Date: 2026-03-27 22:58:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0018_host_geolocation"
down_revision: Union[str, None] = "0017_service_classify"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hosts", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("hosts", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("hosts", "longitude")
    op.drop_column("hosts", "latitude")
