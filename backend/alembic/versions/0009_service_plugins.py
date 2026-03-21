"""service plugin fields

Revision ID: 0009_service_plugins
Revises: 0008_host_enroll_scope
Create Date: 2026-03-20 21:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009_service_plugins"
down_revision: Union[str, None] = "0008_host_enroll_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("host_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("services", sa.Column("plugin_id", sa.String(length=100), nullable=True))
    op.add_column("services", sa.Column("service_type", sa.String(length=100), nullable=True))
    op.add_column("services", sa.Column("endpoint", sa.String(length=255), nullable=True))
    op.add_column("services", sa.Column("plugin_metadata", sa.JSON(), nullable=True, server_default=sa.text("'{}'::json")))
    op.create_index(op.f("ix_services_host_id"), "services", ["host_id"], unique=False)
    op.create_index(op.f("ix_services_plugin_id"), "services", ["plugin_id"], unique=False)
    op.create_index(op.f("ix_services_service_type"), "services", ["service_type"], unique=False)
    op.create_foreign_key("fk_services_host_id", "services", "hosts", ["host_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_services_host_id", "services", type_="foreignkey")
    op.drop_index(op.f("ix_services_service_type"), table_name="services")
    op.drop_index(op.f("ix_services_plugin_id"), table_name="services")
    op.drop_index(op.f("ix_services_host_id"), table_name="services")
    op.drop_column("services", "plugin_metadata")
    op.drop_column("services", "endpoint")
    op.drop_column("services", "service_type")
    op.drop_column("services", "plugin_id")
    op.drop_column("services", "host_id")
