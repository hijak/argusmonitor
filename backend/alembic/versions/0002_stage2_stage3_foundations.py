"""stage 2/3 production foundations follow-on migration

Revision ID: 0002_stage2_stage3
Revises: 0001_enterprise
Create Date: 2026-03-16 18:05:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0002_stage2_stage3'
down_revision: Union[str, None] = '0001_enterprise'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('monitor_results', sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True))
    op.create_index(op.f('ix_monitor_results_workspace_id'), 'monitor_results', ['workspace_id'], unique=False)

    op.add_column('transaction_runs', sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True))
    op.create_index(op.f('ix_transaction_runs_workspace_id'), 'transaction_runs', ['workspace_id'], unique=False)

    op.add_column('oidc_providers', sa.Column('auto_provision', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('oidc_providers', sa.Column('default_role', sa.String(length=50), nullable=False, server_default='member'))

    op.create_table(
        'worker_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True),
        sa.Column('kind', sa.String(length=100), nullable=False),
        sa.Column('payload', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='queued'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_worker_jobs_workspace_id'), 'worker_jobs', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_worker_jobs_kind'), 'worker_jobs', ['kind'], unique=False)
    op.create_index(op.f('ix_worker_jobs_status'), 'worker_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_worker_jobs_scheduled_at'), 'worker_jobs', ['scheduled_at'], unique=False)

    op.create_table(
        'escalation_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False, server_default='all'),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('steps', postgresql.JSON, server_default='[]', nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_escalation_policies_workspace_id'), 'escalation_policies', ['workspace_id'], unique=False)

    op.create_table(
        'retention_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('logs_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('metrics_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('alert_days', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('incident_days', sa.Integer(), nullable=False, server_default='180'),
        sa.Column('run_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_retention_policies_workspace_id'), 'retention_policies', ['workspace_id'], unique=False)

    op.create_table(
        'saml_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('entry_point', sa.String(length=500), nullable=False),
        sa.Column('x509_cert', sa.Text(), nullable=False),
        sa.Column('auto_provision', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('default_role', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_saml_providers_workspace_id'), 'saml_providers', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_saml_providers_enabled'), 'saml_providers', ['enabled'], unique=False)

    op.create_table(
        'scim_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_scim_tokens_workspace_id'), 'scim_tokens', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_scim_tokens_token_hash'), 'scim_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_scim_tokens_expires_at'), 'scim_tokens', ['expires_at'], unique=False)

    op.create_table(
        'scim_group_mappings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('external_group_id', sa.String(length=255), nullable=False),
        sa.Column('external_group_name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_scim_group_mappings_workspace_id'), 'scim_group_mappings', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_scim_group_mappings_external_group_id'), 'scim_group_mappings', ['external_group_id'], unique=False)

    op.create_table(
        'api_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('deprecation_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sunset_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('release_notes_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_api_versions_version'), 'api_versions', ['version'], unique=True)
    op.create_index(op.f('ix_api_versions_deprecation_date'), 'api_versions', ['deprecation_date'], unique=False)
    op.create_index(op.f('ix_api_versions_sunset_date'), 'api_versions', ['sunset_date'], unique=False)

    op.create_table(
        'compliance_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('report_type', sa.String(length=100), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('summary', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('download_url', sa.String(length=500), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_compliance_reports_workspace_id'), 'compliance_reports', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_compliance_reports_report_type'), 'compliance_reports', ['report_type'], unique=False)
    op.create_index(op.f('ix_compliance_reports_period_start'), 'compliance_reports', ['period_start'], unique=False)
    op.create_index(op.f('ix_compliance_reports_period_end'), 'compliance_reports', ['period_end'], unique=False)

    op.create_table(
        'data_exports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('export_type', sa.String(length=100), nullable=False),
        sa.Column('format', sa.String(length=20), nullable=False, server_default='json'),
        sa.Column('filters', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('download_url', sa.String(length=500), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_data_exports_workspace_id'), 'data_exports', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_data_exports_export_type'), 'data_exports', ['export_type'], unique=False)

    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='normal'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='open'),
        sa.Column('assigned_to_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_support_tickets_workspace_id'), 'support_tickets', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_user_id'), 'support_tickets', ['user_id'], unique=False)
    op.create_index(op.f('ix_support_tickets_status'), 'support_tickets', ['status'], unique=False)

    op.create_table(
        'admin_announcements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='info'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_admin_announcements_starts_at'), 'admin_announcements', ['starts_at'], unique=False)
    op.create_index(op.f('ix_admin_announcements_ends_at'), 'admin_announcements', ['ends_at'], unique=False)
    op.create_index(op.f('ix_admin_announcements_active'), 'admin_announcements', ['active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_admin_announcements_active'), table_name='admin_announcements')
    op.drop_index(op.f('ix_admin_announcements_ends_at'), table_name='admin_announcements')
    op.drop_index(op.f('ix_admin_announcements_starts_at'), table_name='admin_announcements')
    op.drop_table('admin_announcements')

    op.drop_index(op.f('ix_support_tickets_status'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_user_id'), table_name='support_tickets')
    op.drop_index(op.f('ix_support_tickets_workspace_id'), table_name='support_tickets')
    op.drop_table('support_tickets')

    op.drop_index(op.f('ix_data_exports_export_type'), table_name='data_exports')
    op.drop_index(op.f('ix_data_exports_workspace_id'), table_name='data_exports')
    op.drop_table('data_exports')

    op.drop_index(op.f('ix_compliance_reports_period_end'), table_name='compliance_reports')
    op.drop_index(op.f('ix_compliance_reports_period_start'), table_name='compliance_reports')
    op.drop_index(op.f('ix_compliance_reports_report_type'), table_name='compliance_reports')
    op.drop_index(op.f('ix_compliance_reports_workspace_id'), table_name='compliance_reports')
    op.drop_table('compliance_reports')

    op.drop_index(op.f('ix_api_versions_sunset_date'), table_name='api_versions')
    op.drop_index(op.f('ix_api_versions_deprecation_date'), table_name='api_versions')
    op.drop_index(op.f('ix_api_versions_version'), table_name='api_versions')
    op.drop_table('api_versions')

    op.drop_index(op.f('ix_scim_group_mappings_external_group_id'), table_name='scim_group_mappings')
    op.drop_index(op.f('ix_scim_group_mappings_workspace_id'), table_name='scim_group_mappings')
    op.drop_table('scim_group_mappings')

    op.drop_index(op.f('ix_scim_tokens_expires_at'), table_name='scim_tokens')
    op.drop_index(op.f('ix_scim_tokens_token_hash'), table_name='scim_tokens')
    op.drop_index(op.f('ix_scim_tokens_workspace_id'), table_name='scim_tokens')
    op.drop_table('scim_tokens')

    op.drop_index(op.f('ix_saml_providers_enabled'), table_name='saml_providers')
    op.drop_index(op.f('ix_saml_providers_workspace_id'), table_name='saml_providers')
    op.drop_table('saml_providers')

    op.drop_index(op.f('ix_retention_policies_workspace_id'), table_name='retention_policies')
    op.drop_table('retention_policies')

    op.drop_index(op.f('ix_escalation_policies_workspace_id'), table_name='escalation_policies')
    op.drop_table('escalation_policies')

    op.drop_index(op.f('ix_worker_jobs_scheduled_at'), table_name='worker_jobs')
    op.drop_index(op.f('ix_worker_jobs_status'), table_name='worker_jobs')
    op.drop_index(op.f('ix_worker_jobs_kind'), table_name='worker_jobs')
    op.drop_index(op.f('ix_worker_jobs_workspace_id'), table_name='worker_jobs')
    op.drop_table('worker_jobs')

    op.drop_column('oidc_providers', 'default_role')
    op.drop_column('oidc_providers', 'auto_provision')

    op.drop_index(op.f('ix_transaction_runs_workspace_id'), table_name='transaction_runs')
    op.drop_column('transaction_runs', 'workspace_id')

    op.drop_index(op.f('ix_monitor_results_workspace_id'), table_name='monitor_results')
    op.drop_column('monitor_results', 'workspace_id')
