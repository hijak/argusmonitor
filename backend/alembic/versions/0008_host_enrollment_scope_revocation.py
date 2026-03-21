"""host enrollment scope and revocation

Revision ID: 0008_host_enroll_scope
Revises: 0007_host_enrollment_tokens
Create Date: 2026-03-20 16:31:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_host_enroll_scope"
down_revision: Union[str, None] = "0007_host_enrollment_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hosts", sa.Column("enrollment_scope", sa.String(length=50), nullable=True, server_default="install"))
    op.add_column("hosts", sa.Column("enrollment_revoked_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("hosts", "enrollment_revoked_at")
    op.drop_column("hosts", "enrollment_scope")
