"""enterprise foundations: orgs, workspaces, rbac, oidc, audit, maintenance, silences

Revision ID: 0001_enterprise
Revises:
Create Date: 2026-03-16 13:32:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_enterprise'
down_revision: Union[str, None] = '0000_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users: add auth_provider, auth_subject
    op.add_column('users', sa.Column('auth_provider', sa.String(length=50), nullable=False, server_default='local'))
    op.add_column('users', sa.Column('auth_subject', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_users_auth_subject', 'users', ['auth_subject'])
    op.create_index(op.f('ix_users_auth_subject'), 'users', ['auth_subject'], unique=False)

    # Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_unique_constraint('uq_organizations_name', 'organizations', ['name'])
    op.create_unique_constraint('uq_organizations_slug', 'organizations', ['slug'])
    op.create_index(op.f('ix_organizations_name'), 'organizations', ['name'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=False)

    # Workspaces
    op.create_table(
        'workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('timezone', sa.String(length=100), nullable=False, server_default='UTC'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_unique_constraint('uq_workspaces_org_slug', 'workspaces', ['organization_id', 'slug'])
    op.create_index(op.f('ix_workspaces_organization_id'), 'workspaces', ['organization_id'], unique=False)

    # Workspace memberships
    op.create_table(
        'workspace_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_unique_constraint('uq_workspace_memberships_workspace_user', 'workspace_memberships', ['workspace_id', 'user_id'])
    op.create_index(op.f('ix_workspace_memberships_workspace_id'), 'workspace_memberships', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_workspace_memberships_user_id'), 'workspace_memberships', ['user_id'], unique=False)

    # OIDC providers
    op.create_table(
        'oidc_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('issuer', sa.String(length=500), nullable=False),
        sa.Column('client_id', sa.String(length=255), nullable=False),
        sa.Column('client_secret', sa.Text, nullable=True),
        sa.Column('authorize_url', sa.String(length=500), nullable=True),
        sa.Column('token_url', sa.String(length=500), nullable=True),
        sa.Column('userinfo_url', sa.String(length=500), nullable=True),
        sa.Column('scopes', postgresql.JSON, server_default='[]', nullable=False),
        sa.Column('enabled', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_oidc_providers_workspace_id'), 'oidc_providers', ['workspace_id'], unique=False)

    # Audit logs
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('resource_type', sa.String(length=100), nullable=False),
        sa.Column('resource_id', sa.String(length=255), nullable=False),
        sa.Column('detail', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('ip_address', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_audit_logs_organization_id'), 'audit_logs', ['organization_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_workspace_id'), 'audit_logs', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_actor_user_id'), 'audit_logs', ['actor_user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_type'), 'audit_logs', ['resource_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_id'), 'audit_logs', ['resource_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)

    # Maintenance windows
    op.create_table(
        'maintenance_windows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scope_type', sa.String(length=50), nullable=False, server_default='all'),
        sa.Column('scope', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_maintenance_windows_workspace_id'), 'maintenance_windows', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_maintenance_windows_starts_at'), 'maintenance_windows', ['starts_at'], unique=False)
    op.create_index(op.f('ix_maintenance_windows_ends_at'), 'maintenance_windows', ['ends_at'], unique=False)
    op.create_index(op.f('ix_maintenance_windows_created_by_user_id'), 'maintenance_windows', ['created_by_user_id'], unique=False)

    # Alert silences
    op.create_table(
        'alert_silences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('matcher', postgresql.JSON, server_default='{}', nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_alert_silences_workspace_id'), 'alert_silences', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_alert_silences_starts_at'), 'alert_silences', ['starts_at'], unique=False)
    op.create_index(op.f('ix_alert_silences_ends_at'), 'alert_silences', ['ends_at'], unique=False)
    op.create_index(op.f('ix_alert_silences_created_by_user_id'), 'alert_silences', ['created_by_user_id'], unique=False)

    # Add workspace_id to core resources
    for table_name in [
        'hosts',
        'services',
        'monitors',
        'transactions',
        'alert_rules',
        'alert_instances',
        'incidents',
        'dashboards',
        'notification_channels',
        'integrations',
        'oncall_teams',
        'log_entries',
    ]:
        op.add_column(table_name, sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True))
        op.create_index(op.f(f'ix_{table_name}_workspace_id'), table_name, ['workspace_id'], unique=False)


def downgrade() -> None:
    for table_name in [
        'oncall_teams',
        'integrations',
        'notification_channels',
        'dashboards',
        'incidents',
        'alert_instances',
        'alert_rules',
        'transactions',
        'monitors',
        'services',
        'hosts',
        'log_entries',
    ]:
        op.drop_index(op.f(f'ix_{table_name}_workspace_id'), table_name=table_name)
        op.drop_column(table_name, 'workspace_id')

    op.drop_table('alert_silences')
    op.drop_table('maintenance_windows')
    op.drop_table('audit_logs')
    op.drop_table('oidc_providers')
    op.drop_table('workspace_memberships')
    op.drop_table('workspaces')
    op.drop_table('organizations')

    op.drop_index(op.f('ix_users_auth_subject'), table_name='users')
    op.drop_constraint('uq_users_auth_subject', 'users', type_='unique')
    op.drop_column('users', 'auth_subject')
    op.drop_column('users', 'auth_provider')
