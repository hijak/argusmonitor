"""baseline: create all core tables from SQLAlchemy models

Revision ID: 0000_baseline
Revises:
Create Date: 2026-03-16 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0000_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Core identity ---
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='admin'),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='UTC'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # --- API keys ---
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('prefix', sa.String(12), nullable=False),
        sa.Column('key_hash', sa.String(255), nullable=False),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_api_keys_user_id'), 'api_keys', ['user_id'], unique=False)

    # --- User preferences ---
    op.create_table(
        'user_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('theme', sa.String(20), server_default='dark'),
        sa.Column('timezone', sa.String(100), server_default='UTC'),
        sa.Column('date_format', sa.String(50), server_default='YYYY-MM-DD'),
        sa.Column('compact_mode', sa.Boolean(), server_default='false'),
        sa.Column('default_dashboard_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # --- AI chat ---
    op.create_table(
        'ai_chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False, server_default='New chat'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_ai_chat_sessions_user_id'), 'ai_chat_sessions', ['user_id'], unique=False)

    op.create_table(
        'ai_chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_chat_sessions.id', ondelete='CASCADE'), nullable=True),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_ai_chat_messages_user_id'), 'ai_chat_messages', ['user_id'], unique=False)

    # --- Monitoring: hosts ---
    op.create_table(
        'hosts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, server_default='server'),
        sa.Column('status', sa.String(50), nullable=False, server_default='unknown'),
        sa.Column('ip_address', sa.String(100), nullable=True),
        sa.Column('os', sa.String(255), nullable=True),
        sa.Column('cpu_percent', sa.Float(), server_default='0'),
        sa.Column('memory_percent', sa.Float(), server_default='0'),
        sa.Column('disk_percent', sa.Float(), server_default='0'),
        sa.Column('uptime', sa.String(50), nullable=True),
        sa.Column('tags', postgresql.JSON, server_default='[]'),
        sa.Column('agent_version', sa.String(50), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_hosts_name'), 'hosts', ['name'], unique=False)

    op.create_table(
        'host_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('host_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hosts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cpu_percent', sa.Float(), nullable=True),
        sa.Column('memory_percent', sa.Float(), nullable=True),
        sa.Column('disk_percent', sa.Float(), nullable=True),
        sa.Column('network_in_bytes', sa.Float(), nullable=True),
        sa.Column('network_out_bytes', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_host_metrics_host_id'), 'host_metrics', ['host_id'], unique=False)
    op.create_index(op.f('ix_host_metrics_recorded_at'), 'host_metrics', ['recorded_at'], unique=False)

    # --- Monitoring: services ---
    op.create_table(
        'services',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='unknown'),
        sa.Column('url', sa.String(500), nullable=True),
        sa.Column('uptime_percent', sa.Float(), server_default='100.0'),
        sa.Column('latency_ms', sa.Float(), server_default='0'),
        sa.Column('requests_per_min', sa.Float(), server_default='0'),
        sa.Column('endpoints_count', sa.Integer(), server_default='0'),
        sa.Column('check_interval', sa.Integer(), server_default='60'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_services_name'), 'services', ['name'], unique=False)

    # --- Monitoring: monitors ---
    op.create_table(
        'monitors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('target', sa.String(500), nullable=False),
        sa.Column('interval_seconds', sa.Integer(), server_default='60'),
        sa.Column('timeout_seconds', sa.Integer(), server_default='30'),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('config', postgresql.JSON, server_default='{}'),
        sa.Column('status', sa.String(50), server_default='unknown'),
        sa.Column('last_check', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'monitor_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('monitor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('monitors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('response_time_ms', sa.Float(), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_monitor_results_monitor_id'), 'monitor_results', ['monitor_id'], unique=False)
    op.create_index(op.f('ix_monitor_results_checked_at'), 'monitor_results', ['checked_at'], unique=False)

    # --- Monitoring: transactions ---
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='unknown'),
        sa.Column('success_rate', sa.Float(), server_default='100.0'),
        sa.Column('avg_duration_ms', sa.Float(), server_default='0'),
        sa.Column('schedule', sa.String(100), server_default='Every 5 min'),
        sa.Column('interval_seconds', sa.Integer(), server_default='300'),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('environment_vars', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_transactions_name'), 'transactions', ['name'], unique=False)

    op.create_table(
        'transaction_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('config', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_transaction_steps_transaction_id'), 'transaction_steps', ['transaction_id'], unique=False)

    op.create_table(
        'transaction_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='running'),
        sa.Column('duration_ms', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_transaction_runs_transaction_id'), 'transaction_runs', ['transaction_id'], unique=False)

    op.create_table(
        'transaction_run_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transaction_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transaction_steps.id', ondelete='SET NULL'), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('duration_ms', sa.Float(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('screenshot_url', sa.String(500), nullable=True),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_transaction_run_steps_run_id'), 'transaction_run_steps', ['run_id'], unique=False)

    # --- Alerting ---
    op.create_table(
        'alert_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(50), nullable=False, server_default='warning'),
        sa.Column('type', sa.String(50), nullable=False, server_default='threshold'),
        sa.Column('condition', postgresql.JSON, nullable=False),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('cooldown_seconds', sa.Integer(), server_default='300'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'alert_instances',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('alert_rules.id', ondelete='CASCADE'), nullable=True),
        sa.Column('assigned_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(50), nullable=False),
        sa.Column('service', sa.String(255), nullable=True),
        sa.Column('host', sa.String(255), nullable=True),
        sa.Column('acknowledged', sa.Boolean(), server_default='false'),
        sa.Column('acknowledged_by', sa.String(255), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved', sa.Boolean(), server_default='false'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_alert_instances_rule_id'), 'alert_instances', ['rule_id'], unique=False)
    op.create_index(op.f('ix_alert_instances_assigned_user_id'), 'alert_instances', ['assigned_user_id'], unique=False)

    # --- Incidents ---
    op.create_table(
        'incidents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ref', sa.String(50), nullable=False, unique=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='investigating'),
        sa.Column('severity', sa.String(50), nullable=False, server_default='warning'),
        sa.Column('assigned_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('affected_hosts', postgresql.JSON, server_default='[]'),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_incidents_assigned_user_id'), 'incidents', ['assigned_user_id'], unique=False)

    op.create_table(
        'incident_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('incidents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('event_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_incident_events_incident_id'), 'incident_events', ['incident_id'], unique=False)

    # --- Logs ---
    op.create_table(
        'log_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('level', sa.String(20), nullable=False),
        sa.Column('service', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('metadata', postgresql.JSON, server_default='{}'),
    )
    op.create_index(op.f('ix_log_entries_timestamp'), 'log_entries', ['timestamp'], unique=False)
    op.create_index(op.f('ix_log_entries_level'), 'log_entries', ['level'], unique=False)
    op.create_index(op.f('ix_log_entries_service'), 'log_entries', ['service'], unique=False)

    # --- Dashboards ---
    op.create_table(
        'dashboards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), server_default='custom'),
        sa.Column('config', postgresql.JSON, server_default='{}'),
        sa.Column('widgets_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # --- Integrations & notifications ---
    op.create_table(
        'notification_channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('config', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), server_default='disconnected'),
        sa.Column('config', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # --- On-call ---
    op.create_table(
        'oncall_teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('timezone', sa.String(100), nullable=False, server_default='UTC'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_oncall_teams_name'), 'oncall_teams', ['name'], unique=True)

    op.create_table(
        'oncall_team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('oncall_teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_oncall_team_members_team_id'), 'oncall_team_members', ['team_id'], unique=False)
    op.create_index(op.f('ix_oncall_team_members_user_id'), 'oncall_team_members', ['user_id'], unique=False)

    op.create_table(
        'oncall_shifts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('oncall_teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('person_name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('escalation_level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_oncall_shifts_team_id'), 'oncall_shifts', ['team_id'], unique=False)
    op.create_index(op.f('ix_oncall_shifts_person_name'), 'oncall_shifts', ['person_name'], unique=False)
    op.create_index(op.f('ix_oncall_shifts_start_at'), 'oncall_shifts', ['start_at'], unique=False)
    op.create_index(op.f('ix_oncall_shifts_end_at'), 'oncall_shifts', ['end_at'], unique=False)

    # --- Agent actions ---
    op.create_table(
        'agent_actions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('host_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hosts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_chat_sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('kind', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('params', postgresql.JSON, server_default='{}'),
        sa.Column('result', postgresql.JSON, server_default='{}'),
        sa.Column('error_text', sa.Text(), nullable=True),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_agent_actions_host_id'), 'agent_actions', ['host_id'], unique=False)
    op.create_index(op.f('ix_agent_actions_requested_by_user_id'), 'agent_actions', ['requested_by_user_id'], unique=False)
    op.create_index(op.f('ix_agent_actions_session_id'), 'agent_actions', ['session_id'], unique=False)
    op.create_index(op.f('ix_agent_actions_kind'), 'agent_actions', ['kind'], unique=False)
    op.create_index(op.f('ix_agent_actions_status'), 'agent_actions', ['status'], unique=False)


def downgrade() -> None:
    for table in [
        'agent_actions', 'oncall_shifts', 'oncall_team_members', 'oncall_teams',
        'integrations', 'notification_channels', 'dashboards',
        'log_entries', 'incident_events', 'incidents',
        'alert_instances', 'alert_rules',
        'transaction_run_steps', 'transaction_runs', 'transaction_steps', 'transactions',
        'monitor_results', 'monitors', 'services',
        'host_metrics', 'hosts',
        'ai_chat_messages', 'ai_chat_sessions',
        'user_preferences', 'api_keys', 'users',
    ]:
        op.drop_table(table)
