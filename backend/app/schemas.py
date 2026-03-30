from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    workspace_id: Optional[UUID] = None


class OIDCStartResponse(BaseModel):
    authorize_url: str
    state: str


class OIDCCallbackRequest(BaseModel):
    code: str
    state: str


class SAMLACSRequest(BaseModel):
    SAMLResponse: str
    RelayState: str


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
    mobile_number: Optional[str] = None
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
    mobile_number: Optional[str] = None
    role: str = "member"
    timezone: str = "UTC"


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    role: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


# --- Hosts ---


class HostCreate(BaseModel):
    name: str
    type: str = "server"
    ip_address: Optional[str] = None
    os: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: list[str] = []


class HostUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    ip_address: Optional[str] = None
    os: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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
    latitude: Optional[float]
    longitude: Optional[float]
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
    enrollment_pending: bool = False
    enrollment_status: str = "none"
    enrollment_scope: str = "install"
    enrollment_token_expires_at: Optional[datetime] = None
    enrollment_token_used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class HostMetricOut(BaseModel):
    cpu_percent: Optional[float]
    memory_percent: Optional[float]
    disk_percent: Optional[float]
    recorded_at: datetime

    model_config = {"from_attributes": True}


class HostWithSparkline(HostOut):
    spark: list[float] = []


class HostListResponse(BaseModel):
    items: list[HostWithSparkline]
    total: int
    limit: int
    offset: int


class HostCountsOut(BaseModel):
    all: int
    server: int
    database: int
    container: int
    network: int
    live_agent_hosts: int


class OverviewHostSummary(BaseModel):
    id: UUID
    name: str
    status: str
    cpu_percent: float
    memory_percent: float
    uptime: Optional[str]
    last_seen: Optional[datetime]
    is_agent_connected: bool = False
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
    host_id: Optional[UUID] = None
    host_name: Optional[str] = None
    host_status: Optional[str] = None
    host_type: Optional[str] = None
    host_ip_address: Optional[str] = None
    plugin_id: Optional[str] = None
    suspected_plugin_id: Optional[str] = None
    classification_state: str = "generic"
    classification_confidence: Optional[float] = None
    suggested_profile_ids: list[str] = []
    classification_source: Optional[str] = None
    service_type: Optional[str] = None
    endpoint: Optional[str] = None
    plugin_metadata: dict[str, Any] = {}
    uptime_percent: float
    latency_ms: float
    requests_per_min: float
    endpoints_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceWithSparkline(ServiceOut):
    spark: list[float] = []


class ServiceMetricPointOut(BaseModel):
    recorded_at: datetime
    latency_ms: float
    requests_per_min: float
    uptime_percent: float

    model_config = {"from_attributes": True}


class ServiceListResponse(BaseModel):
    items: list[ServiceWithSparkline]
    total: int
    limit: int
    offset: int


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
    cron_expression: Optional[str] = None
    interval_seconds: int = 300
    enabled: bool = True
    environment_vars: dict[str, str] = {}
    steps: list[TransactionStepCreate] = []


class TransactionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    environment_vars: Optional[dict[str, str]] = None
    steps: Optional[list[TransactionStepCreate]] = None


class TransactionOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    success_rate: float
    avg_duration_ms: float
    schedule: str
    cron_expression: Optional[str]
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
    screenshot_url: Optional[str]
    reply: Optional[str]
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
    replay_url: Optional[str]
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
    scope: dict[str, Any] = {}
    ownership: dict[str, Any] = {}
    oncall_team_id: Optional[UUID] = None
    escalation_policy_id: Optional[UUID] = None
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
    scope: dict[str, Any] = {}
    ownership: dict[str, Any] = {}
    oncall_team_id: Optional[UUID] = None
    escalation_policy_id: Optional[UUID] = None
    enabled: bool
    cooldown_seconds: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertPresetOut(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    severity: str
    target_type: str
    condition: dict[str, Any]
    scope: dict[str, Any] = {}
    cooldown_seconds: int = 0
    plugin_id: Optional[str] = None
    profile_id: Optional[str] = None
    source: str = "core"


class AlertAcknowledgeRequest(BaseModel):
    reason: Optional[str] = None


class AlertIngestRequest(BaseModel):
    message: str
    severity: str = "warning"
    status: str = "firing"
    fingerprint: Optional[str] = None
    host: Optional[str] = None
    service: Optional[str] = None
    metadata: dict[str, Any] = {}
    ownership: dict[str, Any] = {}


class AlertResolveRequest(BaseModel):
    message: str


class BulkAlertAcknowledgeRequest(BaseModel):
    alert_ids: list[UUID]
    reason: Optional[str] = None


class BulkAlertResolveRequest(BaseModel):
    alert_ids: list[UUID]
    message: str


class AlertSeverityUpdateRequest(BaseModel):
    severity: str


class AlertInstanceOut(BaseModel):
    id: UUID
    rule_id: Optional[UUID]
    assigned_user_id: Optional[UUID] = None
    assigned_team_id: Optional[UUID] = None
    fingerprint: Optional[str] = None
    occurrence_count: int = 1
    first_fired_at: Optional[datetime] = None
    last_fired_at: Optional[datetime] = None
    message: str
    severity: str
    service: Optional[str]
    host: Optional[str]
    ownership: dict[str, Any] = {}
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    acknowledgment_reason: Optional[str] = None
    resolution_message: Optional[str] = None
    resolved: bool
    resolved_at: Optional[datetime] = None
    created_at: datetime
    assigned_user: Optional[UserOut] = None

    model_config = {"from_attributes": True}


class AlertSummaryOut(BaseModel):
    active: int
    resolved: int
    all: int
    critical: int
    warning: int
    info: int
    acknowledged: int
    routed: int


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


class DashboardTemplateOut(BaseModel):
    id: str
    name: str
    description: str
    category: str
    widget_count: int
    available_count: int = 0
    recommended: bool = False
    verified_count: int = 0
    suspected_count: int = 0
    hinted_count: int = 0
    recommendation_reason: Optional[str] = None
    plugin_id: Optional[str] = None
    service_type: Optional[str] = None
    service_group: Optional[str] = None
    profile: Optional[str] = None


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
    url: Optional[str] = None


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
    ai_model: str = "default"
    ai_response_style: str = "balanced"
    ai_auto_summarize_incidents: bool = True
    ai_include_context: bool = True
    telemetry_enabled: bool = True


class UserPreferenceUpdate(BaseModel):
    theme: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    compact_mode: Optional[bool] = None
    default_dashboard_id: Optional[UUID] = None
    ai_model: Optional[str] = None
    ai_response_style: Optional[str] = None
    ai_auto_summarize_incidents: Optional[bool] = None
    ai_include_context: Optional[bool] = None
    telemetry_enabled: Optional[bool] = None


class AIProviderConfigOut(BaseModel):
    provider: str = "openai-compatible"
    source: str
    endpoint: str
    model: str
    api_key_configured: bool = False
    api_key_masked: Optional[str] = None
    can_edit: bool = False
    byok_enabled: bool = False
    supports_custom_endpoint: bool = True


class AIProviderConfigUpdate(BaseModel):
    endpoint: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    clear_api_key: bool = False


class AgentOut(BaseModel):
    id: UUID
    name: str
    ip_address: Optional[str]
    agent_version: Optional[str]
    status: str
    os: Optional[str]
    last_seen: Optional[datetime]
    model_config = {"from_attributes": True}


class AgentInterfaceReport(BaseModel):
    name: str
    rx_bytes_per_sec: float = 0
    tx_bytes_per_sec: float = 0
    is_up: bool = True
    speed_mbps: Optional[int] = None
    ipv4: Optional[str] = None


class AgentServiceReport(BaseModel):
    name: str
    plugin_id: str
    service_type: str
    endpoint: Optional[str] = None
    status: str = "healthy"
    latency_ms: float = 0
    requests_per_min: float = 0
    uptime_percent: float = 100.0
    endpoints_count: int = 1
    tags: list[str] = []
    metadata: dict[str, Any] = {}


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
    network_interfaces: list[AgentInterfaceReport] = []
    capabilities: dict[str, Any] = {}
    services: list[AgentServiceReport] = []


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


class RetentionPolicyUpdate(BaseModel):
    name: Optional[str] = None
    logs_days: Optional[int] = None
    metrics_days: Optional[int] = None
    alert_days: Optional[int] = None
    incident_days: Optional[int] = None
    run_days: Optional[int] = None
    enabled: Optional[bool] = None


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


class OnCallTeamUpdate(BaseModel):
    name: str
    timezone: str = "UTC"
    description: Optional[str] = None


class OnCallTeamMemberUpdate(BaseModel):
    role: str = "member"


class OnCallShiftCreate(BaseModel):
    team_id: UUID
    user_id: Optional[UUID] = None
    person_name: Optional[str] = None
    email: Optional[str] = None
    start_at: datetime
    end_at: datetime
    escalation_level: int = 1
    notes: Optional[str] = None


class OnCallShiftUpdate(BaseModel):
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


# --- Kubernetes ---


class K8sClusterCreate(BaseModel):
    name: str
    api_server: Optional[str] = None
    auth_type: str = "kubeconfig"
    auth_config: dict[str, Any] = {}


class K8sClusterUpdate(BaseModel):
    name: Optional[str] = None
    api_server: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[dict[str, Any]] = None


class K8sClusterOut(BaseModel):
    id: UUID
    name: str
    api_server: str
    auth_type: str
    status: str
    version: Optional[str]
    node_count: int
    namespace_count: int
    pod_count: int
    running_pods: int
    cpu_capacity: Optional[str]
    memory_capacity: Optional[str]
    cpu_usage_percent: float
    memory_usage_percent: float
    last_seen: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class K8sNamespaceOut(BaseModel):
    id: UUID
    cluster_id: UUID
    name: str
    status: str
    pod_count: int
    created_at: Optional[datetime]
    labels: dict[str, str] = {}

    model_config = {"from_attributes": True}


class K8sNodeOut(BaseModel):
    id: UUID
    cluster_id: UUID
    name: str
    status: str
    role: Optional[str]
    kubelet_version: Optional[str]
    os_image: Optional[str]
    container_runtime: Optional[str]
    cpu_capacity: Optional[str]
    memory_capacity: Optional[str]
    cpu_usage_percent: float
    memory_usage_percent: float
    pod_count: int
    conditions: list[dict[str, Any]] = []
    labels: dict[str, str] = {}
    last_seen: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sPodOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    node_name: Optional[str]
    status: str
    restart_count: int
    container_count: int
    ready_containers: int
    cpu_usage: Optional[str]
    memory_usage: Optional[str]
    ip_address: Optional[str]
    labels: dict[str, str] = {}
    started_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sDeploymentOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    status: str
    desired_replicas: int
    ready_replicas: int
    available_replicas: int
    updated_replicas: int
    strategy: Optional[str]
    labels: dict[str, str] = {}
    created_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sStatefulSetOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    status: str
    desired_replicas: int
    ready_replicas: int
    service_name: Optional[str]
    labels: dict[str, str] = {}
    created_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sDaemonSetOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    status: str
    desired_number_scheduled: int
    number_ready: int
    updated_number_scheduled: int
    labels: dict[str, str] = {}
    created_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sJobOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    kind: str
    status: str
    completions: int
    succeeded: int
    failed: int
    active: int
    schedule: Optional[str]
    labels: dict[str, str] = {}
    created_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sServiceOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: str
    name: str
    service_type: str
    cluster_ip: Optional[str]
    external_ip: Optional[str]
    ports: list[dict[str, Any]] = []
    selector: dict[str, str] = {}
    labels: dict[str, str] = {}
    created_at: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class K8sEventOut(BaseModel):
    id: UUID
    cluster_id: UUID
    namespace: Optional[str]
    involved_kind: Optional[str]
    involved_name: Optional[str]
    type: str
    reason: Optional[str]
    message: Optional[str]
    event_time: Optional[datetime]
    count: int
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


# --- Docker Swarm ---


class SwarmClusterCreate(BaseModel):
    name: str
    docker_host: str = "unix:///var/run/docker.sock"
    auth_type: str = "local"
    auth_config: dict[str, Any] = {}


class SwarmClusterUpdate(BaseModel):
    name: Optional[str] = None
    docker_host: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[dict[str, Any]] = None


class SwarmClusterOut(BaseModel):
    id: UUID
    name: str
    docker_host: str
    auth_type: str
    status: str
    swarm_id: Optional[str]
    manager_count: int
    worker_count: int
    node_count: int
    service_count: int
    task_count: int
    stack_count: int
    cpu_usage_percent: float
    memory_usage_percent: float
    last_seen: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SwarmNodeOut(BaseModel):
    id: UUID
    cluster_id: UUID
    node_id: str
    hostname: str
    role: Optional[str]
    availability: Optional[str]
    status: Optional[str]
    manager_status: Optional[str]
    engine_version: Optional[str]
    addr: Optional[str]
    cpu_count: int
    memory_bytes: int
    labels: dict[str, str] = {}
    last_seen: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SwarmServiceOut(BaseModel):
    id: UUID
    cluster_id: UUID
    service_id: str
    name: str
    image: Optional[str]
    mode: Optional[str]
    replicas_desired: int
    replicas_running: int
    update_status: Optional[str]
    published_ports: list[dict[str, Any]] = []
    stack: Optional[str]
    labels: dict[str, str] = {}
    last_seen: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SwarmTaskOut(BaseModel):
    id: UUID
    cluster_id: UUID
    task_id: str
    service_name: Optional[str]
    slot: int
    node_name: Optional[str]
    desired_state: Optional[str]
    current_state: Optional[str]
    error: Optional[str]
    message: Optional[str]
    container_id: Optional[str]
    image: Optional[str]
    stack: Optional[str]
    last_seen: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SwarmNetworkOut(BaseModel):
    id: UUID
    cluster_id: UUID
    network_id: str
    name: str
    driver: Optional[str]
    scope: Optional[str]
    attachable: bool
    ingress: bool
    labels: dict[str, str] = {}
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class SwarmVolumeOut(BaseModel):
    id: UUID
    cluster_id: UUID
    name: str
    driver: Optional[str]
    scope: Optional[str]
    labels: dict[str, str] = {}
    options: dict[str, Any] = {}
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class SwarmEventOut(BaseModel):
    id: UUID
    cluster_id: UUID
    event_type: str
    action: str
    actor_id: Optional[str]
    actor_name: Optional[str]
    scope: Optional[str]
    message: Optional[str]
    event_time: Optional[datetime]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class ProxmoxClusterCreate(BaseModel):
    name: str
    base_url: str
    token_id: Optional[str] = None
    token_secret: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    verify_tls: bool = True


class ProxmoxClusterUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    token_id: Optional[str] = None
    token_secret: Optional[str] = None
    verify_tls: Optional[bool] = None


class ProxmoxClusterOut(BaseModel):
    id: UUID
    name: str
    base_url: str
    verify_tls: bool
    status: str
    cluster_name: Optional[str]
    version: Optional[str]
    node_count: int
    vm_count: int
    container_count: int
    storage_count: int
    last_discovery: Optional[datetime]
    last_seen: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProxmoxNodeOut(BaseModel):
    id: UUID
    cluster_id: UUID
    node: str
    status: Optional[str]
    level: Optional[str]
    ip_address: Optional[str]
    cpu_percent: float
    memory_used_bytes: int
    memory_total_bytes: int
    rootfs_used_bytes: int
    rootfs_total_bytes: int
    uptime_seconds: int
    max_cpu: int
    ssl_fingerprint: Optional[str]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class ProxmoxVMOut(BaseModel):
    id: UUID
    cluster_id: UUID
    vmid: int
    node: Optional[str]
    name: str
    status: Optional[str]
    cpu_percent: float
    memory_used_bytes: int
    memory_total_bytes: int
    disk_used_bytes: int
    disk_total_bytes: int
    uptime_seconds: int
    max_cpu: int
    template: bool
    tags: Optional[str]
    pool: Optional[str]
    guest_agent_status: Optional[str]
    guest_hostname: Optional[str]
    guest_os: Optional[str]
    guest_kernel: Optional[str]
    guest_primary_ip: Optional[str]
    guest_ip_addresses: list[Any] = []
    guest_interfaces: list[Any] = []
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class ProxmoxContainerOut(BaseModel):
    id: UUID
    cluster_id: UUID
    vmid: int
    node: Optional[str]
    name: str
    status: Optional[str]
    cpu_percent: float
    memory_used_bytes: int
    memory_total_bytes: int
    disk_used_bytes: int
    disk_total_bytes: int
    uptime_seconds: int
    max_cpu: int
    template: bool
    tags: Optional[str]
    pool: Optional[str]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class ProxmoxStorageOut(BaseModel):
    id: UUID
    cluster_id: UUID
    storage: str
    node: Optional[str]
    storage_type: Optional[str]
    status: Optional[str]
    shared: bool
    enabled: bool
    content: Optional[str]
    used_bytes: int
    total_bytes: int
    available_bytes: int
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}


class ProxmoxTaskOut(BaseModel):
    id: UUID
    cluster_id: UUID
    upid: str
    node: Optional[str]
    user: Optional[str]
    task_type: Optional[str]
    resource_id: Optional[str]
    status: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_seconds: Optional[int]
    description: Optional[str]
    last_seen: Optional[datetime]

    model_config = {"from_attributes": True}
