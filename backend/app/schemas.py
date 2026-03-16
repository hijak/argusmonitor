from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    timezone: str = "UTC"
    is_active: bool = True
    auth_provider: str = "local"
    auth_subject: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    role: str = "member"
    timezone: str = "UTC"


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


# --- Hosts ---

class HostCreate(BaseModel):
    name: str
    type: str = "server"
    ip_address: Optional[str] = None
    os: Optional[str] = None
    tags: list[str] = []


class HostUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    ip_address: Optional[str] = None
    os: Optional[str] = None
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    uptime: Optional[str] = None
    tags: Optional[list[str]] = None


class HostOut(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    ip_address: Optional[str]
    os: Optional[str]
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    uptime: Optional[str]
    tags: list[str]
    agent_version: Optional[str]
    last_seen: Optional[datetime]
    created_at: datetime
    is_agent_connected: bool = False
    data_source: str = "seeded"

    model_config = {"from_attributes": True}


class HostMetricOut(BaseModel):
    cpu_percent: Optional[float]
    memory_percent: Optional[float]
    disk_percent: Optional[float]
    recorded_at: datetime

    model_config = {"from_attributes": True}


class HostWithSparkline(HostOut):
    spark: list[float] = []


# --- Services ---

class ServiceCreate(BaseModel):
    name: str
    url: Optional[str] = None
    check_interval: int = 60


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    url: Optional[str] = None
    uptime_percent: Optional[float] = None
    latency_ms: Optional[float] = None
    requests_per_min: Optional[float] = None
    endpoints_count: Optional[int] = None
    check_interval: Optional[int] = None


class ServiceOut(BaseModel):
    id: UUID
    name: str
    status: str
    url: Optional[str]
    uptime_percent: float
    latency_ms: float
    requests_per_min: float
    endpoints_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceWithSparkline(ServiceOut):
    spark: list[float] = []


# --- Monitors ---

class MonitorCreate(BaseModel):
    name: str
    type: str
    target: str
    interval_seconds: int = 60
    timeout_seconds: int = 30
    config: dict[str, Any] = {}


class MonitorUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    target: Optional[str] = None
    interval_seconds: Optional[int] = None
    timeout_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    config: Optional[dict[str, Any]] = None


class MonitorOut(BaseModel):
    id: UUID
    name: str
    type: str
    target: str
    interval_seconds: int
    timeout_seconds: int
    enabled: bool
    config: dict[str, Any]
    status: str
    last_check: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class MonitorResultOut(BaseModel):
    id: UUID
    monitor_id: UUID
    status: str
    response_time_ms: Optional[float]
    status_code: Optional[int]
    error_message: Optional[str]
    checked_at: datetime

    model_config = {"from_attributes": True}


# --- Transactions ---

class TransactionStepCreate(BaseModel):
    order: int
    type: str
    label: str
    config: dict[str, Any] = {}


class TransactionStepOut(BaseModel):
    id: UUID
    order: int
    type: str
    label: str
    config: dict[str, Any]

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule: str = "Every 5 min"
    interval_seconds: int = 300
    environment_vars: dict[str, str] = {}
    steps: list[TransactionStepCreate] = []


class TransactionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    interval_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    environment_vars: Optional[dict[str, str]] = None


class TransactionOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    success_rate: float
    avg_duration_ms: float
    schedule: str
    interval_seconds: int
    enabled: bool
    steps: list[TransactionStepOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionRunStepOut(BaseModel):
    id: UUID
    order: int
    type: str
    label: str
    status: str
    duration_ms: Optional[float]
    error_message: Optional[str]
    detail: Optional[str]
    executed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TransactionRunOut(BaseModel):
    id: UUID
    transaction_id: UUID
    status: str
    duration_ms: Optional[float]
    error_message: Optional[str]
    ai_summary: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    step_results: list[TransactionRunStepOut] = []

    model_config = {"from_attributes": True}


# --- Alerts ---

class AlertRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    severity: str = "warning"
    type: str = "threshold"
    condition: dict[str, Any] = {}
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    cooldown_seconds: int = 300


class AlertRuleOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    severity: str
    type: str
    condition: dict[str, Any]
    target_type: Optional[str]
    target_id: Optional[UUID]
    enabled: bool
    cooldown_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertInstanceOut(BaseModel):
    id: UUID
    rule_id: Optional[UUID]
    assigned_user_id: Optional[UUID] = None
    message: str
    severity: str
    service: Optional[str]
    host: Optional[str]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    resolved: bool
    created_at: datetime
    assigned_user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


# --- Incidents ---

class IncidentCreate(BaseModel):
    title: str
    severity: str = "warning"
    affected_hosts: list[str] = []


class IncidentEventCreate(BaseModel):
    type: str  # alert, system, ai, action
    event_text: str


class IncidentEventOut(BaseModel):
    id: UUID
    type: str
    event_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentOut(BaseModel):
    id: UUID
    ref: str
    title: str
    status: str
    severity: str
    assigned_user_id: Optional[UUID] = None
    affected_hosts: list[str]
    started_at: datetime
    resolved_at: Optional[datetime]
    events: list[IncidentEventOut] = []
    assigned_user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


# --- Logs ---

class LogEntryCreate(BaseModel):
    level: str
    service: str
    message: str
    metadata: dict[str, Any] = {}
    timestamp: Optional[datetime] = None


class LogEntryOut(BaseModel):
    id: UUID
    timestamp: datetime
    level: str
    service: str
    message: str
    metadata: dict[str, Any] = {}

    model_config = {"from_attributes": True}


# --- Dashboards ---

class DashboardCreate(BaseModel):
    name: str
    type: str = "custom"
    config: dict[str, Any] = {}


class DashboardOut(BaseModel):
    id: UUID
    name: str
    type: str
    config: dict[str, Any]
    widgets_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- AI ---

class AIChatSessionCreate(BaseModel):
    title: Optional[str] = None


class AIChatSessionOut(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[UUID] = None


class AIChatResponse(BaseModel):
    role: str
    content: str
    timestamp: datetime
    session_id: Optional[UUID] = None


class AIGenerateTransactionRequest(BaseModel):
    prompt: str


class AIExplainFailureRequest(BaseModel):
    run_id: UUID


# --- Settings ---

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyOut(BaseModel):
    id: UUID
    name: str
    prefix: str
    last_used: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}

class ApiKeyCreated(ApiKeyOut):
    key: str

class NotificationChannelCreate(BaseModel):
    name: str
    type: str
    config: dict[str, Any] = {}

class NotificationChannelUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[dict[str, Any]] = None

class NotificationChannelOut(BaseModel):
    id: UUID
    name: str
    type: str
    enabled: bool
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class IntegrationCreate(BaseModel):
    name: str
    type: str
    config: dict[str, Any] = {}

class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    config: Optional[dict[str, Any]] = None

class IntegrationOut(BaseModel):
    id: UUID
    name: str
    type: str
    status: str
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class UserPreferenceOut(BaseModel):
    theme: str
    timezone: str
    date_format: str
    compact_mode: bool
    default_dashboard_id: Optional[UUID] = None

class UserPreferenceUpdate(BaseModel):
    theme: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    compact_mode: Optional[bool] = None
    default_dashboard_id: Optional[UUID] = None

class AgentOut(BaseModel):
    id: UUID
    name: str
    ip_address: Optional[str]
    agent_version: Optional[str]
    status: str
    os: Optional[str]
    last_seen: Optional[datetime]
    model_config = {"from_attributes": True}


class AgentHeartbeatRequest(BaseModel):
    name: str
    type: str = "server"
    ip_address: Optional[str] = None
    os: Optional[str] = None
    tags: list[str] = []
    agent_version: str = "1.0.0"
    cpu_percent: float = Field(ge=0, le=100)
    memory_percent: float = Field(ge=0, le=100)
    disk_percent: float = Field(ge=0, le=100)
    uptime: Optional[str] = None
    network_in_bytes: Optional[float] = None
    network_out_bytes: Optional[float] = None


class AgentActionOut(BaseModel):
    id: UUID
    kind: str
    status: str
    session_id: Optional[UUID] = None
    params: dict[str, Any] = {}
    result: dict[str, Any] = {}
    error_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AgentActionResultRequest(BaseModel):
    status: str
    result: dict[str, Any] = {}
    error_text: Optional[str] = None


class AgentHeartbeatResponse(BaseModel):
    host_id: UUID
    status: str
    recorded_at: datetime
    action: Optional[AgentActionOut] = None


# --- Enterprise ---

class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceCreate(BaseModel):
    organization_id: UUID
    name: str
    slug: str
    timezone: str = "UTC"


class WorkspaceOut(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    timezone: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMembershipCreate(BaseModel):
    user_id: UUID
    role: str = "member"


class WorkspaceMembershipOut(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OIDCProviderCreate(BaseModel):
    workspace_id: UUID
    name: str
    issuer: str
    client_id: str
    client_secret: Optional[str] = None
    authorize_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    scopes: list[str] = ["openid", "profile", "email"]
    enabled: bool = True


class OIDCProviderOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    issuer: str
    client_id: str
    authorize_url: Optional[str]
    token_url: Optional[str]
    userinfo_url: Optional[str]
    scopes: list[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: UUID
    organization_id: Optional[UUID] = None
    workspace_id: Optional[UUID] = None
    actor_user_id: Optional[UUID] = None
    action: str
    resource_type: str
    resource_id: str
    detail: dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceWindowCreate(BaseModel):
    workspace_id: UUID
    name: str
    starts_at: datetime
    ends_at: datetime
    scope_type: str = "all"
    scope: dict[str, Any] = {}
    reason: Optional[str] = None


class MaintenanceWindowOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    starts_at: datetime
    ends_at: datetime
    scope_type: str
    scope: dict[str, Any] = {}
    reason: Optional[str] = None
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlertSilenceCreate(BaseModel):
    workspace_id: UUID
    name: str
    matcher: dict[str, Any] = {}
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None


class AlertSilenceOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    matcher: dict[str, Any] = {}
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationTestRequest(BaseModel):
    subject: Optional[str] = None
    text: str
    message: Optional[str] = None


class EscalationPolicyCreate(BaseModel):
    workspace_id: UUID
    name: str
    target_type: str = "all"
    target_id: Optional[UUID] = None
    steps: list[dict[str, Any]] = []
    enabled: bool = True


class EscalationPolicyOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    target_type: str
    target_id: Optional[UUID] = None
    steps: list[dict[str, Any]] = []
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RetentionPolicyCreate(BaseModel):
    workspace_id: UUID
    name: str
    logs_days: int = 30
    metrics_days: int = 30
    alert_days: int = 90
    incident_days: int = 180
    run_days: int = 30
    enabled: bool = True


class RetentionPolicyOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    logs_days: int
    metrics_days: int
    alert_days: int
    incident_days: int
    run_days: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OnCallTeamCreate(BaseModel):
    name: str
    timezone: str = "UTC"
    description: Optional[str] = None


class OnCallTeamMemberCreate(BaseModel):
    user_id: UUID
    role: str = "member"


class OnCallTeamMemberOut(BaseModel):
    id: UUID
    team_id: UUID
    user_id: UUID
    role: str
    created_at: datetime
    updated_at: datetime
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


class OnCallTeamOut(BaseModel):
    id: UUID
    name: str
    timezone: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    members: list[OnCallTeamMemberOut] = []

    model_config = {"from_attributes": True}


class OnCallShiftCreate(BaseModel):
    team_id: UUID
    user_id: Optional[UUID] = None
    person_name: Optional[str] = None
    email: Optional[str] = None
    start_at: datetime
    end_at: datetime
    escalation_level: int = 1
    notes: Optional[str] = None


class OnCallShiftOut(BaseModel):
    id: UUID
    team_id: UUID
    user_id: Optional[UUID] = None
    person_name: str
    email: Optional[str] = None
    start_at: datetime
    end_at: datetime
    escalation_level: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


class SAMLProviderCreate(BaseModel):
    workspace_id: UUID
    name: str
    entry_point: str
    x509_cert: str
    auto_provision: bool = False
    default_role: str = "member"
    enabled: bool = True


class SAMLProviderOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    entry_point: str
    auto_provision: bool
    default_role: str
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SCIMTokenCreate(BaseModel):
    workspace_id: UUID
    name: str
    expires_at: Optional[datetime] = None


class SCIMTokenOut(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SCIMGroupMappingCreate(BaseModel):
    workspace_id: UUID
    external_group_id: str
    external_group_name: str
    role: str = "member"


class SCIMGroupMappingOut(BaseModel):
    id: UUID
    workspace_id: UUID
    external_group_id: str
    external_group_name: str
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplianceReportCreate(BaseModel):
    workspace_id: UUID
    report_type: str
    period_start: datetime
    period_end: datetime


class ComplianceReportOut(BaseModel):
    id: UUID
    workspace_id: UUID
    report_type: str
    period_start: datetime
    period_end: datetime
    status: str
    summary: dict[str, Any] = {}
    download_url: Optional[str] = None
    generated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataExportCreate(BaseModel):
    workspace_id: UUID
    export_type: str
    format: str = "json"
    filters: dict[str, Any] = {}


class DataExportOut(BaseModel):
    id: UUID
    workspace_id: UUID
    export_type: str
    format: str
    filters: dict[str, Any] = {}
    status: str
    download_url: Optional[str] = None
    generated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupportTicketCreate(BaseModel):
    workspace_id: UUID
    subject: str
    description: str
    priority: str = "normal"


class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_user_id: Optional[UUID] = None


class SupportTicketOut(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: Optional[UUID] = None
    subject: str
    description: str
    priority: str
    status: str
    assigned_to_user_id: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminAnnouncementCreate(BaseModel):
    title: str
    message: str
    severity: str = "info"
    starts_at: datetime
    ends_at: datetime
    active: bool = True


class AdminAnnouncementOut(BaseModel):
    id: UUID
    title: str
    message: str
    severity: str
    starts_at: datetime
    ends_at: datetime
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class APIVersionOut(BaseModel):
    id: UUID
    version: str
    deprecation_date: Optional[datetime] = None
    sunset_date: Optional[datetime] = None
    release_notes_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

# --- Overview ---

class OverviewStats(BaseModel):
    monitored_hosts: int
    active_alerts: int
    health_score: float
    transaction_success: float
    hosts_change: str
    alerts_change: str
    health_change: str
    tx_change: str
