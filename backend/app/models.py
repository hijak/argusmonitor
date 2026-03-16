import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="admin")
    timezone = Column(String(100), nullable=False, default="UTC")
    is_active = Column(Boolean, nullable=False, default=True)
    auth_provider = Column(String(50), nullable=False, default="local")
    auth_subject = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False, unique=True, index=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_workspaces_org_slug"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    timezone = Column(String(100), nullable=False, default="UTC")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_memberships_workspace_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="member")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OIDCProvider(Base):
    __tablename__ = "oidc_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    issuer = Column(String(500), nullable=False)
    client_id = Column(String(255), nullable=False)
    client_secret = Column(Text)
    authorize_url = Column(String(500))
    token_url = Column(String(500))
    userinfo_url = Column(String(500))
    scopes = Column(JSON, default=list)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(255), nullable=False, index=True)
    detail = Column(JSON, default=dict)
    ip_address = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    scope_type = Column(String(50), nullable=False, default="all")
    scope = Column(JSON, default=dict)
    reason = Column(Text)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AlertSilence(Base):
    __tablename__ = "alert_silences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    matcher = Column(JSON, default=dict)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    reason = Column(Text)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Host(Base):
    __tablename__ = "hosts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, default="server")  # server, database, container, network
    status = Column(String(50), nullable=False, default="unknown")  # healthy, warning, critical, unknown
    ip_address = Column(String(100))
    os = Column(String(255))
    cpu_percent = Column(Float, default=0)
    memory_percent = Column(Float, default=0)
    disk_percent = Column(Float, default=0)
    uptime = Column(String(50))
    tags = Column(JSON, default=list)
    agent_version = Column(String(50))
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    metrics = relationship("HostMetric", back_populates="host", cascade="all, delete-orphan")


class HostMetric(Base):
    __tablename__ = "host_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    host_id = Column(UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    cpu_percent = Column(Float)
    memory_percent = Column(Float)
    disk_percent = Column(Float)
    network_in_bytes = Column(Float)
    network_out_bytes = Column(Float)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    host = relationship("Host", back_populates="metrics")


class Service(Base):
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="unknown")
    url = Column(String(500))
    uptime_percent = Column(Float, default=100.0)
    latency_ms = Column(Float, default=0)
    requests_per_min = Column(Float, default=0)
    endpoints_count = Column(Integer, default=0)
    check_interval = Column(Integer, default=60)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # http, ping, tcp, dns, ssl
    target = Column(String(500), nullable=False)
    interval_seconds = Column(Integer, default=60)
    timeout_seconds = Column(Integer, default=30)
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default=dict)
    status = Column(String(50), default="unknown")
    last_check = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    results = relationship("MonitorResult", back_populates="monitor", cascade="all, delete-orphan")


class MonitorResult(Base):
    __tablename__ = "monitor_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False)  # up, down, degraded
    response_time_ms = Column(Float)
    status_code = Column(Integer)
    error_message = Column(Text)
    checked_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    monitor = relationship("Monitor", back_populates="results")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    status = Column(String(50), nullable=False, default="unknown")  # healthy, warning, critical
    success_rate = Column(Float, default=100.0)
    avg_duration_ms = Column(Float, default=0)
    schedule = Column(String(100), default="Every 5 min")
    interval_seconds = Column(Integer, default=300)
    enabled = Column(Boolean, default=True)
    environment_vars = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    steps = relationship("TransactionStep", back_populates="transaction", cascade="all, delete-orphan", order_by="TransactionStep.order")
    runs = relationship("TransactionRun", back_populates="transaction", cascade="all, delete-orphan")


class TransactionStep(Base):
    __tablename__ = "transaction_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    order = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)  # navigate, input, click, wait, api, assert
    label = Column(String(255), nullable=False)
    config = Column(JSON, default=dict)  # url, selector, value, method, headers, body, assertion
    created_at = Column(DateTime(timezone=True), default=utcnow)

    transaction = relationship("Transaction", back_populates="steps")


class TransactionRun(Base):
    __tablename__ = "transaction_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="running")  # running, success, failed
    duration_ms = Column(Float)
    error_message = Column(Text)
    ai_summary = Column(Text)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True))

    transaction = relationship("Transaction", back_populates="runs")
    step_results = relationship("TransactionRunStep", back_populates="run", cascade="all, delete-orphan")


class TransactionRunStep(Base):
    __tablename__ = "transaction_run_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id = Column(UUID(as_uuid=True), ForeignKey("transaction_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    step_id = Column(UUID(as_uuid=True), ForeignKey("transaction_steps.id", ondelete="SET NULL"))
    order = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)
    label = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, running, success, failed, skipped
    duration_ms = Column(Float)
    error_message = Column(Text)
    screenshot_url = Column(String(500))
    detail = Column(Text)
    executed_at = Column(DateTime(timezone=True))

    run = relationship("TransactionRun", back_populates="step_results")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    severity = Column(String(50), nullable=False, default="warning")  # critical, warning, info
    type = Column(String(50), nullable=False, default="threshold")
    condition = Column(JSON, nullable=False)
    target_type = Column(String(50))  # host, service, monitor, transaction
    target_id = Column(UUID(as_uuid=True))
    enabled = Column(Boolean, default=True)
    cooldown_seconds = Column(Integer, default=300)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    instances = relationship("AlertInstance", back_populates="rule", cascade="all, delete-orphan")


class AlertInstance(Base):
    __tablename__ = "alert_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("alert_rules.id", ondelete="CASCADE"), index=True)
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    message = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False)
    service = Column(String(255))
    host = Column(String(255))
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(255))
    acknowledged_at = Column(DateTime(timezone=True))
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    extra_data = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    rule = relationship("AlertRule", back_populates="instances")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    ref = Column(String(50), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="investigating")
    severity = Column(String(50), nullable=False, default="warning")
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    affected_hosts = Column(JSON, default=list)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    events = relationship("IncidentEvent", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentEvent.created_at")


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # alert, system, ai, action
    event_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship("Incident", back_populates="events")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    level = Column(String(20), nullable=False, index=True)  # info, warn, error, debug
    service = Column(String(255), nullable=False, index=True)
    message = Column(Text, nullable=False)
    extra_data = Column("metadata", JSON, default=dict)


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="custom")  # system, custom, ai
    config = Column(JSON, default=dict)
    widgets_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    prefix = Column(String(12), nullable=False)
    key_hash = Column(String(255), nullable=False)
    last_used = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # email, slack, pagerduty, webhook, teams
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # slack, pagerduty, jira, github, webhook, teams, opsgenie
    status = Column(String(50), default="disconnected")  # connected, disconnected, error
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    theme = Column(String(20), default="dark")
    timezone = Column(String(100), default="UTC")
    date_format = Column(String(50), default="YYYY-MM-DD")
    compact_mode = Column(Boolean, default=False)
    default_dashboard_id = Column(UUID(as_uuid=True))
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AIChatSession(Base):
    __tablename__ = "ai_chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New chat")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    host_id = Column(UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("ai_chat_sessions.id", ondelete="SET NULL"), index=True)
    kind = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, running, completed, failed
    params = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    error_text = Column(Text)
    claimed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OnCallTeam(Base):
    __tablename__ = "oncall_teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    timezone = Column(String(100), nullable=False, default="UTC")
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OnCallTeamMember(Base):
    __tablename__ = "oncall_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    team_id = Column(UUID(as_uuid=True), ForeignKey("oncall_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="member")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OnCallShift(Base):
    __tablename__ = "oncall_shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    team_id = Column(UUID(as_uuid=True), ForeignKey("oncall_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    person_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255))
    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False, index=True)
    escalation_level = Column(Integer, nullable=False, default=1)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
