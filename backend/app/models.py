import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
    Enum as SAEnum,
    UniqueConstraint,
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
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_workspaces_org_slug"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    timezone = Column(String(100), nullable=False, default="UTC")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    memberships = relationship("WorkspaceMembership", back_populates="workspace")
    oidc_providers = relationship("OIDCProvider", back_populates="workspace")
    saml_providers = relationship("SAMLProvider", back_populates="workspace")
    scim_tokens = relationship("SCIMToken", back_populates="workspace")
    scim_group_mappings = relationship("SCIMGroupMapping", back_populates="workspace")
    compliance_reports = relationship("ComplianceReport", back_populates="workspace")
    data_exports = relationship("DataExport", back_populates="workspace")
    support_tickets = relationship("SupportTicket", back_populates="workspace")


class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "user_id", name="uq_workspace_memberships_workspace_user"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False, default="member")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="memberships")


class OIDCProvider(Base):
    __tablename__ = "oidc_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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

    workspace = relationship("Workspace", back_populates="oidc_providers")


class EscalationPolicy(Base):
    __tablename__ = "escalation_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    target_type = Column(String(50), nullable=False, default="all")
    target_id = Column(UUID(as_uuid=True))
    steps = Column(JSON, default=list)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    logs_days = Column(Integer, nullable=False, default=30)
    metrics_days = Column(Integer, nullable=False, default=30)
    alert_days = Column(Integer, nullable=False, default=90)
    incident_days = Column(Integer, nullable=False, default=180)
    run_days = Column(Integer, nullable=False, default=30)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class WorkerJob(Base):
    __tablename__ = "worker_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    kind = Column(String(100), nullable=False, index=True)
    dedupe_key = Column(String(255), index=True)
    payload = Column(JSON, default=dict)
    status = Column(String(50), nullable=False, default="queued", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text)
    scheduled_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        index=True,
    )
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    actor_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(255), nullable=False, index=True)
    detail = Column(JSON, default=dict)
    ip_address = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    scope_type = Column(String(50), nullable=False, default="all")
    scope = Column(JSON, default=dict)
    reason = Column(Text)
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AlertSilence(Base):
    __tablename__ = "alert_silences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    matcher = Column(JSON, default=dict)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    reason = Column(Text)
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Host(Base):
    __tablename__ = "hosts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False, index=True)
    enrollment_token_hash = Column(String(64), index=True)
    enrollment_token_expires_at = Column(DateTime(timezone=True))
    enrollment_token_used_at = Column(DateTime(timezone=True))
    enrollment_scope = Column(String(50), default="install")
    enrollment_revoked_at = Column(DateTime(timezone=True))
    type = Column(
        String(50), nullable=False, default="server"
    )  # server, database, container, network
    status = Column(
        String(50), nullable=False, default="unknown"
    )  # healthy, warning, critical, unknown
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

    metrics = relationship(
        "HostMetric", back_populates="host", cascade="all, delete-orphan"
    )


class HostMetric(Base):
    __tablename__ = "host_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    host_id = Column(
        UUID(as_uuid=True),
        ForeignKey("hosts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cpu_percent = Column(Float)
    memory_percent = Column(Float)
    disk_percent = Column(Float)
    network_in_bytes = Column(Float)
    network_out_bytes = Column(Float)
    network_interfaces = Column(JSON, default=list)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    host = relationship("Host", back_populates="metrics")


class Service(Base):
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    host_id = Column(UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="SET NULL"), index=True)
    plugin_id = Column(String(100), index=True)
    service_type = Column(String(100), index=True)
    endpoint = Column(String(255))
    plugin_metadata = Column(JSON, default=dict)
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

    metrics = relationship("ServiceMetric", back_populates="service", cascade="all, delete-orphan")


class ServiceMetric(Base):
    __tablename__ = "service_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    service_id = Column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    latency_ms = Column(Float, default=0)
    requests_per_min = Column(Float, default=0)
    uptime_percent = Column(Float, default=100.0)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    service = relationship("Service", back_populates="metrics")


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
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

    results = relationship(
        "MonitorResult", back_populates="monitor", cascade="all, delete-orphan"
    )


class MonitorResult(Base):
    __tablename__ = "monitor_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    monitor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("monitors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(50), nullable=False)  # up, down, degraded
    response_time_ms = Column(Float)
    status_code = Column(Integer)
    error_message = Column(Text)
    checked_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    monitor = relationship("Monitor", back_populates="results")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    status = Column(
        String(50), nullable=False, default="unknown"
    )  # healthy, warning, critical
    success_rate = Column(Float, default=100.0)
    avg_duration_ms = Column(Float, default=0)
    schedule = Column(String(100), default="Every 5 min")
    cron_expression = Column(String(100))
    interval_seconds = Column(Integer, default=300)
    enabled = Column(Boolean, default=True)
    environment_vars = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    steps = relationship(
        "TransactionStep",
        back_populates="transaction",
        cascade="all, delete-orphan",
        order_by="TransactionStep.order",
    )
    runs = relationship(
        "TransactionRun", back_populates="transaction", cascade="all, delete-orphan"
    )


class TransactionStep(Base):
    __tablename__ = "transaction_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order = Column(Integer, nullable=False)
    type = Column(
        String(50), nullable=False
    )  # navigate, input, click, wait, api, assert
    label = Column(String(255), nullable=False)
    config = Column(
        JSON, default=dict
    )  # url, selector, value, method, headers, body, assertion
    created_at = Column(DateTime(timezone=True), default=utcnow)

    transaction = relationship("Transaction", back_populates="steps")


class TransactionRun(Base):
    __tablename__ = "transaction_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        String(50), nullable=False, default="running"
    )  # running, success, failed
    duration_ms = Column(Float)
    error_message = Column(Text)
    ai_summary = Column(Text)
    replay_url = Column(String(500))
    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True))

    transaction = relationship("Transaction", back_populates="runs")
    step_results = relationship(
        "TransactionRunStep", back_populates="run", cascade="all, delete-orphan"
    )


class TransactionRunStep(Base):
    __tablename__ = "transaction_run_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transaction_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_id = Column(
        UUID(as_uuid=True), ForeignKey("transaction_steps.id", ondelete="SET NULL")
    )
    order = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)
    label = Column(String(255), nullable=False)
    status = Column(
        String(50), nullable=False, default="pending"
    )  # pending, running, success, failed, skipped
    duration_ms = Column(Float)
    error_message = Column(Text)
    screenshot_url = Column(String(500))
    reply = Column(Text)
    detail = Column(Text)
    executed_at = Column(DateTime(timezone=True))

    run = relationship("TransactionRun", back_populates="step_results")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False)
    description = Column(Text)
    severity = Column(
        String(50), nullable=False, default="warning"
    )  # critical, warning, info
    type = Column(String(50), nullable=False, default="threshold")
    condition = Column(JSON, nullable=False)
    target_type = Column(String(50))  # host, service, monitor, transaction
    target_id = Column(UUID(as_uuid=True))
    enabled = Column(Boolean, default=True)
    cooldown_seconds = Column(Integer, default=300)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    instances = relationship(
        "AlertInstance", back_populates="rule", cascade="all, delete-orphan"
    )


class AlertInstance(Base):
    __tablename__ = "alert_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    rule_id = Column(
        UUID(as_uuid=True), ForeignKey("alert_rules.id", ondelete="CASCADE"), index=True
    )
    assigned_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
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
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    ref = Column(String(50), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="investigating")
    severity = Column(String(50), nullable=False, default="warning")
    assigned_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    affected_hosts = Column(JSON, default=list)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    events = relationship(
        "IncidentEvent",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentEvent.created_at",
    )


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    incident_id = Column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(50), nullable=False)  # alert, system, ai, action
    event_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    incident = relationship("Incident", back_populates="events")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    level = Column(String(20), nullable=False, index=True)  # info, warn, error, debug
    service = Column(String(255), nullable=False, index=True)
    message = Column(Text, nullable=False)
    extra_data = Column("metadata", JSON, default=dict)


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="custom")  # system, custom, ai
    config = Column(JSON, default=dict)
    widgets_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    prefix = Column(String(12), nullable=False)
    key_hash = Column(String(255), nullable=False)
    last_used = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # email, slack, pagerduty, webhook, teams
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False)
    type = Column(
        String(50), nullable=False
    )  # slack, pagerduty, jira, github, webhook, teams, opsgenie
    status = Column(
        String(50), default="disconnected"
    )  # connected, disconnected, error
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    theme = Column(String(20), default="dark")
    timezone = Column(String(100), default="UTC")
    date_format = Column(String(50), default="YYYY-MM-DD")
    compact_mode = Column(Boolean, default=False)
    default_dashboard_id = Column(UUID(as_uuid=True))
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AIChatSession(Base):
    __tablename__ = "ai_chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False, default="New chat")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"),
        index=True,
    )
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    host_id = Column(
        UUID(as_uuid=True),
        ForeignKey("hosts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_chat_sessions.id", ondelete="SET NULL"),
        index=True,
    )
    kind = Column(String(100), nullable=False, index=True)
    status = Column(
        String(50), nullable=False, default="pending", index=True
    )  # pending, running, completed, failed
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
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False, unique=True, index=True)
    timezone = Column(String(100), nullable=False, default="UTC")
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OnCallTeamMember(Base):
    __tablename__ = "oncall_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("oncall_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False, default="member")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class OnCallShift(Base):
    __tablename__ = "oncall_shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("oncall_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    person_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255))
    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False, index=True)
    escalation_level = Column(Integer, nullable=False, default=1)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SAMLProvider(Base):
    __tablename__ = "saml_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    entry_point = Column(String(500), nullable=False)
    x509_cert = Column(Text, nullable=False)
    auto_provision = Column(Boolean, default=False)
    default_role = Column(String(50), default="member")
    enabled = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="saml_providers")


class SCIMToken(Base):
    __tablename__ = "scim_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at = Column(DateTime(timezone=True))
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="scim_tokens")


class SCIMGroupMapping(Base):
    __tablename__ = "scim_group_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_group_id = Column(String(255), nullable=False, index=True)
    external_group_name = Column(String(255), nullable=False)
    role = Column(String(50), default="member")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="scim_group_mappings")


class APIVersion(Base):
    __tablename__ = "api_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    version = Column(String(20), nullable=False, unique=True, index=True)
    deprecation_date = Column(DateTime(timezone=True), nullable=True, index=True)
    sunset_date = Column(DateTime(timezone=True), nullable=True, index=True)
    release_notes_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_type = Column(String(100), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending")
    summary = Column(JSON, default=dict)
    download_url = Column(String(500))
    generated_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="compliance_reports")


class DataExport(Base):
    __tablename__ = "data_exports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    export_type = Column(String(100), nullable=False, index=True)
    format = Column(String(20), nullable=False, default="json")
    filters = Column(JSON, default=dict)
    status = Column(String(50), nullable=False, default="pending")
    download_url = Column(String(500))
    generated_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="data_exports")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="normal")
    status = Column(String(50), default="open", index=True)
    assigned_to_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    workspace = relationship("Workspace", back_populates="support_tickets")


class AdminAnnouncement(Base):
    __tablename__ = "admin_announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="info")
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class K8sCluster(Base):
    __tablename__ = "k8s_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True
    )
    name = Column(String(255), nullable=False, index=True)
    api_server = Column(String(500), nullable=False)
    auth_type = Column(
        String(50), nullable=False, default="kubeconfig"
    )  # kubeconfig, token, certificate
    auth_config = Column(JSON, default=dict)  # kubeconfig content, token, or cert paths
    status = Column(
        String(50), nullable=False, default="unknown"
    )  # healthy, warning, critical, unknown
    version = Column(String(50))
    node_count = Column(Integer, default=0)
    namespace_count = Column(Integer, default=0)
    pod_count = Column(Integer, default=0)
    running_pods = Column(Integer, default=0)
    cpu_capacity = Column(String(50))
    memory_capacity = Column(String(50))
    cpu_usage_percent = Column(Float, default=0)
    memory_usage_percent = Column(Float, default=0)
    last_discovery = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    namespaces = relationship(
        "K8sNamespace", back_populates="cluster", cascade="all, delete-orphan"
    )
    nodes = relationship(
        "K8sNode", back_populates="cluster", cascade="all, delete-orphan"
    )
    pods = relationship(
        "K8sPod", back_populates="cluster", cascade="all, delete-orphan"
    )
    deployments = relationship(
        "K8sDeployment", back_populates="cluster", cascade="all, delete-orphan"
    )
    statefulsets = relationship(
        "K8sStatefulSet", back_populates="cluster", cascade="all, delete-orphan"
    )
    daemonsets = relationship(
        "K8sDaemonSet", back_populates="cluster", cascade="all, delete-orphan"
    )
    jobs = relationship(
        "K8sJob", back_populates="cluster", cascade="all, delete-orphan"
    )
    services = relationship(
        "K8sService", back_populates="cluster", cascade="all, delete-orphan"
    )
    events = relationship(
        "K8sEvent", back_populates="cluster", cascade="all, delete-orphan"
    )


class K8sNamespace(Base):
    __tablename__ = "k8s_namespaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Active")
    pod_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True))
    labels = Column(JSON, default=dict)

    cluster = relationship("K8sCluster", back_populates="namespaces")


class K8sNode(Base):
    __tablename__ = "k8s_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    status = Column(
        String(50), nullable=False, default="unknown"
    )  # ready, not_ready, unknown
    role = Column(String(50))  # control-plane, worker
    kubelet_version = Column(String(50))
    os_image = Column(String(255))
    container_runtime = Column(String(100))
    cpu_capacity = Column(String(50))
    memory_capacity = Column(String(50))
    cpu_usage_percent = Column(Float, default=0)
    memory_usage_percent = Column(Float, default=0)
    pod_count = Column(Integer, default=0)
    conditions = Column(JSON, default=list)
    labels = Column(JSON, default=dict)
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="nodes")


class K8sPod(Base):
    __tablename__ = "k8s_pods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    node_name = Column(String(255))
    status = Column(
        String(50), nullable=False, default="unknown"
    )  # running, pending, succeeded, failed, unknown
    restart_count = Column(Integer, default=0)
    container_count = Column(Integer, default=0)
    ready_containers = Column(Integer, default=0)
    cpu_usage = Column(String(50))
    memory_usage = Column(String(50))
    ip_address = Column(String(100))
    labels = Column(JSON, default=dict)
    started_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="pods")


class K8sDeployment(Base):
    __tablename__ = "k8s_deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="unknown")
    desired_replicas = Column(Integer, default=0)
    ready_replicas = Column(Integer, default=0)
    available_replicas = Column(Integer, default=0)
    updated_replicas = Column(Integer, default=0)
    strategy = Column(String(100))
    labels = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="deployments")


class K8sStatefulSet(Base):
    __tablename__ = "k8s_statefulsets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="unknown")
    desired_replicas = Column(Integer, default=0)
    ready_replicas = Column(Integer, default=0)
    service_name = Column(String(255))
    labels = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="statefulsets")


class K8sDaemonSet(Base):
    __tablename__ = "k8s_daemonsets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="unknown")
    desired_number_scheduled = Column(Integer, default=0)
    number_ready = Column(Integer, default=0)
    updated_number_scheduled = Column(Integer, default=0)
    labels = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="daemonsets")


class K8sJob(Base):
    __tablename__ = "k8s_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("k8s_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    kind = Column(String(50), nullable=False, default="Job")
    status = Column(String(50), nullable=False, default="unknown")
    completions = Column(Integer, default=0)
    succeeded = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    active = Column(Integer, default=0)
    schedule = Column(String(255))
    labels = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="jobs")


class K8sService(Base):
    __tablename__ = "k8s_services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    namespace = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    service_type = Column(String(50), nullable=False, default="ClusterIP")
    cluster_ip = Column(String(100))
    external_ip = Column(String(255))
    ports = Column(JSON, default=list)
    selector = Column(JSON, default=dict)
    labels = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="services")


class K8sEvent(Base):
    __tablename__ = "k8s_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(
        UUID(as_uuid=True),
        ForeignKey("k8s_clusters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    namespace = Column(String(255), index=True)
    involved_kind = Column(String(100))
    involved_name = Column(String(255), index=True)
    type = Column(String(50), nullable=False, default="Normal")
    reason = Column(String(255))
    message = Column(Text)
    event_time = Column(DateTime(timezone=True))
    count = Column(Integer, default=1)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("K8sCluster", back_populates="events")


class SwarmCluster(Base):
    __tablename__ = "swarm_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, index=True)
    docker_host = Column(String(500), nullable=False)
    auth_type = Column(String(50), nullable=False, default="local")  # local, ssh, tcp
    auth_config = Column(JSON, default=dict)
    status = Column(String(50), nullable=False, default="unknown")
    swarm_id = Column(String(255))
    manager_count = Column(Integer, default=0)
    worker_count = Column(Integer, default=0)
    node_count = Column(Integer, default=0)
    service_count = Column(Integer, default=0)
    task_count = Column(Integer, default=0)
    stack_count = Column(Integer, default=0)
    cpu_usage_percent = Column(Float, default=0)
    memory_usage_percent = Column(Float, default=0)
    last_discovery = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    nodes = relationship("SwarmNode", back_populates="cluster", cascade="all, delete-orphan")
    services = relationship("SwarmService", back_populates="cluster", cascade="all, delete-orphan")
    tasks = relationship("SwarmTask", back_populates="cluster", cascade="all, delete-orphan")
    networks = relationship("SwarmNetwork", back_populates="cluster", cascade="all, delete-orphan")
    volumes = relationship("SwarmVolume", back_populates="cluster", cascade="all, delete-orphan")
    events = relationship("SwarmEvent", back_populates="cluster", cascade="all, delete-orphan")


class SwarmNode(Base):
    __tablename__ = "swarm_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(String(255), nullable=False, index=True)
    hostname = Column(String(255), nullable=False, index=True)
    role = Column(String(50))
    availability = Column(String(50))
    status = Column(String(50))
    manager_status = Column(String(100))
    engine_version = Column(String(100))
    addr = Column(String(100))
    cpu_count = Column(Integer, default=0)
    memory_bytes = Column(BigInteger, default=0)
    labels = Column(JSON, default=dict)
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="nodes")


class SwarmService(Base):
    __tablename__ = "swarm_services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    image = Column(String(500))
    mode = Column(String(50))
    replicas_desired = Column(Integer, default=0)
    replicas_running = Column(Integer, default=0)
    update_status = Column(String(100))
    published_ports = Column(JSON, default=list)
    stack = Column(String(255), index=True)
    labels = Column(JSON, default=dict)
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="services")


class SwarmTask(Base):
    __tablename__ = "swarm_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(255), nullable=False, index=True)
    service_name = Column(String(255), index=True)
    slot = Column(Integer, default=0)
    node_name = Column(String(255))
    desired_state = Column(String(50))
    current_state = Column(String(100))
    error = Column(Text)
    message = Column(Text)
    container_id = Column(String(255))
    image = Column(String(500))
    stack = Column(String(255), index=True)
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="tasks")


class SwarmNetwork(Base):
    __tablename__ = "swarm_networks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    network_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    driver = Column(String(100))
    scope = Column(String(50))
    attachable = Column(Boolean, default=False)
    ingress = Column(Boolean, default=False)
    labels = Column(JSON, default=dict)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="networks")


class SwarmVolume(Base):
    __tablename__ = "swarm_volumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    driver = Column(String(100))
    scope = Column(String(50))
    labels = Column(JSON, default=dict)
    options = Column(JSON, default=dict)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="volumes")


class SwarmEvent(Base):
    __tablename__ = "swarm_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("swarm_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    actor_id = Column(String(255))
    actor_name = Column(String(255), index=True)
    scope = Column(String(50))
    message = Column(Text)
    event_time = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("SwarmCluster", back_populates="events")


class ProxmoxCluster(Base):
    __tablename__ = "proxmox_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False, index=True)
    base_url = Column(String(500), nullable=False)
    token_id = Column(String(255))
    token_secret = Column(Text)
    username = Column(String(255))
    password = Column(Text)
    verify_tls = Column(Boolean, nullable=False, default=True)
    status = Column(String(50), nullable=False, default="unknown")
    cluster_name = Column(String(255))
    version = Column(String(100))
    node_count = Column(Integer, default=0)
    vm_count = Column(Integer, default=0)
    container_count = Column(Integer, default=0)
    storage_count = Column(Integer, default=0)
    last_discovery = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    nodes = relationship("ProxmoxNode", back_populates="cluster", cascade="all, delete-orphan")
    vms = relationship("ProxmoxVM", back_populates="cluster", cascade="all, delete-orphan")
    containers = relationship("ProxmoxContainer", back_populates="cluster", cascade="all, delete-orphan")
    storage = relationship("ProxmoxStorage", back_populates="cluster", cascade="all, delete-orphan")
    tasks = relationship("ProxmoxTask", back_populates="cluster", cascade="all, delete-orphan")


class ProxmoxNode(Base):
    __tablename__ = "proxmox_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("proxmox_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    node = Column(String(255), nullable=False, index=True)
    status = Column(String(50))
    level = Column(String(50))
    ip_address = Column(String(100))
    cpu_percent = Column(Float, default=0)
    memory_used_bytes = Column(BigInteger, default=0)
    memory_total_bytes = Column(BigInteger, default=0)
    rootfs_used_bytes = Column(BigInteger, default=0)
    rootfs_total_bytes = Column(BigInteger, default=0)
    uptime_seconds = Column(BigInteger, default=0)
    max_cpu = Column(Integer, default=0)
    ssl_fingerprint = Column(String(255))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("ProxmoxCluster", back_populates="nodes")


class ProxmoxVM(Base):
    __tablename__ = "proxmox_vms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("proxmox_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    vmid = Column(Integer, nullable=False, index=True)
    node = Column(String(255))
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50))
    cpu_percent = Column(Float, default=0)
    memory_used_bytes = Column(BigInteger, default=0)
    memory_total_bytes = Column(BigInteger, default=0)
    disk_used_bytes = Column(BigInteger, default=0)
    disk_total_bytes = Column(BigInteger, default=0)
    uptime_seconds = Column(BigInteger, default=0)
    max_cpu = Column(Integer, default=0)
    template = Column(Boolean, default=False)
    tags = Column(String(500))
    pool = Column(String(255))
    guest_agent_status = Column(String(50), default="unknown")
    guest_hostname = Column(String(255))
    guest_os = Column(String(255))
    guest_kernel = Column(String(255))
    guest_primary_ip = Column(String(100))
    guest_ip_addresses = Column(JSON, default=list)
    guest_interfaces = Column(JSON, default=list)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("ProxmoxCluster", back_populates="vms")


class ProxmoxContainer(Base):
    __tablename__ = "proxmox_containers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("proxmox_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    vmid = Column(Integer, nullable=False, index=True)
    node = Column(String(255))
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50))
    cpu_percent = Column(Float, default=0)
    memory_used_bytes = Column(BigInteger, default=0)
    memory_total_bytes = Column(BigInteger, default=0)
    disk_used_bytes = Column(BigInteger, default=0)
    disk_total_bytes = Column(BigInteger, default=0)
    uptime_seconds = Column(BigInteger, default=0)
    max_cpu = Column(Integer, default=0)
    template = Column(Boolean, default=False)
    tags = Column(String(500))
    pool = Column(String(255))
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("ProxmoxCluster", back_populates="containers")


class ProxmoxStorage(Base):
    __tablename__ = "proxmox_storage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("proxmox_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    storage = Column(String(255), nullable=False, index=True)
    node = Column(String(255))
    storage_type = Column(String(100))
    status = Column(String(50))
    shared = Column(Boolean, default=False)
    enabled = Column(Boolean, default=True)
    content = Column(String(500))
    used_bytes = Column(BigInteger, default=0)
    total_bytes = Column(BigInteger, default=0)
    available_bytes = Column(BigInteger, default=0)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("ProxmoxCluster", back_populates="storage")


class ProxmoxTask(Base):
    __tablename__ = "proxmox_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("proxmox_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    upid = Column(String(500), nullable=False, index=True)
    node = Column(String(255))
    user = Column(String(255))
    task_type = Column(String(100))
    resource_id = Column(String(255))
    status = Column(String(100))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    description = Column(Text)
    last_seen = Column(DateTime(timezone=True))

    cluster = relationship("ProxmoxCluster", back_populates="tasks")
