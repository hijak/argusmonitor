"""service classification states

Revision ID: 0017_service_classify
Revises: 0016_worker_job_dedupe_claiming
Create Date: 2026-03-26 16:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision: str = "0017_service_classify"
down_revision: Union[str, None] = "0016_worker_job_dedupe_claiming"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("classification_state", sa.String(length=50), nullable=False, server_default="generic"))
    op.add_column("services", sa.Column("suspected_plugin_id", sa.String(length=100), nullable=True))
    op.add_column("services", sa.Column("classification_confidence", sa.Float(), nullable=True))
    op.add_column("services", sa.Column("suggested_profile_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    op.add_column("services", sa.Column("classification_source", sa.String(length=100), nullable=True))

    op.create_index(op.f("ix_services_classification_state"), "services", ["classification_state"], unique=False)
    op.create_index(op.f("ix_services_suspected_plugin_id"), "services", ["suspected_plugin_id"], unique=False)

    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        bind.execute(
            text(
                """
                UPDATE services
                SET classification_state = CASE
                        WHEN COALESCE((plugin_metadata->>'suggested')::boolean, false) = true AND plugin_id IS NOT NULL THEN 'suspected'
                        WHEN plugin_id IS NOT NULL THEN 'verified'
                        ELSE 'generic'
                    END,
                    suspected_plugin_id = CASE
                        WHEN COALESCE((plugin_metadata->>'suggested')::boolean, false) = true AND plugin_id IS NOT NULL THEN plugin_id
                        WHEN plugin_id IS NOT NULL THEN plugin_id
                        ELSE NULL
                    END,
                    classification_confidence = CASE
                        WHEN COALESCE((plugin_metadata->>'suggested')::boolean, false) = true AND plugin_id IS NOT NULL THEN 0.65
                        WHEN plugin_id IS NOT NULL THEN 1.0
                        ELSE 0.25
                    END,
                    suggested_profile_ids = CASE
                        WHEN COALESCE(plugin_id, '') = 'vordr-stack' OR COALESCE(service_type, '') = 'vordr-stack' THEN '["vordr-stack"]'::json
                        WHEN COALESCE(plugin_id, '') = 'ai-gateways' OR COALESCE(service_type, '') = 'ai-gateway' THEN '["ai-gateways"]'::json
                        WHEN COALESCE(plugin_id, '') = 'telephony-pbx' OR COALESCE(service_type, '') = 'telephony-pbx' THEN '["telephony-pbx"]'::json
                        WHEN COALESCE(plugin_id, '') = 'voice-stack' OR COALESCE(service_type, '') = 'voice-stack' THEN '["voice-stack"]'::json
                        WHEN COALESCE(plugin_id, '') = 'web-publishing' OR COALESCE(service_type, '') IN ('http', 'https', 'web-publishing') THEN '["web-publishing"]'::json
                        ELSE '[]'::json
                    END,
                    classification_source = COALESCE(plugin_metadata->>'source', CASE WHEN plugin_id IS NOT NULL THEN 'agent' ELSE 'manual' END)
                """
            )
        )
        bind.execute(
            text(
                """
                UPDATE services
                SET plugin_id = NULL
                WHERE classification_state = 'suspected'
                """
            )
        )
    elif dialect == "sqlite":
        bind.execute(
            text(
                """
                UPDATE services
                SET classification_state = CASE
                        WHEN COALESCE(json_extract(plugin_metadata, '$.suggested'), 0) = 1 AND plugin_id IS NOT NULL THEN 'suspected'
                        WHEN plugin_id IS NOT NULL THEN 'verified'
                        ELSE 'generic'
                    END,
                    suspected_plugin_id = CASE
                        WHEN COALESCE(json_extract(plugin_metadata, '$.suggested'), 0) = 1 AND plugin_id IS NOT NULL THEN plugin_id
                        WHEN plugin_id IS NOT NULL THEN plugin_id
                        ELSE NULL
                    END,
                    classification_confidence = CASE
                        WHEN COALESCE(json_extract(plugin_metadata, '$.suggested'), 0) = 1 AND plugin_id IS NOT NULL THEN 0.65
                        WHEN plugin_id IS NOT NULL THEN 1.0
                        ELSE 0.25
                    END,
                    suggested_profile_ids = CASE
                        WHEN COALESCE(plugin_id, '') = 'vordr-stack' OR COALESCE(service_type, '') = 'vordr-stack' THEN '["vordr-stack"]'
                        WHEN COALESCE(plugin_id, '') = 'ai-gateways' OR COALESCE(service_type, '') = 'ai-gateway' THEN '["ai-gateways"]'
                        WHEN COALESCE(plugin_id, '') = 'telephony-pbx' OR COALESCE(service_type, '') = 'telephony-pbx' THEN '["telephony-pbx"]'
                        WHEN COALESCE(plugin_id, '') = 'voice-stack' OR COALESCE(service_type, '') = 'voice-stack' THEN '["voice-stack"]'
                        WHEN COALESCE(plugin_id, '') = 'web-publishing' OR COALESCE(service_type, '') IN ('http', 'https', 'web-publishing') THEN '["web-publishing"]'
                        ELSE '[]'
                    END,
                    classification_source = COALESCE(json_extract(plugin_metadata, '$.source'), CASE WHEN plugin_id IS NOT NULL THEN 'agent' ELSE 'manual' END)
                """
            )
        )
        bind.execute(
            text(
                """
                UPDATE services
                SET plugin_id = NULL
                WHERE classification_state = 'suspected'
                """
            )
        )

    op.alter_column("services", "classification_state", server_default=None)
    op.alter_column("services", "suggested_profile_ids", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_services_suspected_plugin_id"), table_name="services")
    op.drop_index(op.f("ix_services_classification_state"), table_name="services")
    op.drop_column("services", "classification_source")
    op.drop_column("services", "suggested_profile_ids")
    op.drop_column("services", "classification_confidence")
    op.drop_column("services", "suspected_plugin_id")
    op.drop_column("services", "classification_state")
