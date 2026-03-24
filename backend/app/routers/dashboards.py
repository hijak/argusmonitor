import math
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import AlertInstance, Dashboard, Host, Service, Transaction, User, Workspace
from app.schemas import DashboardCreate, DashboardOut, DashboardTemplateOut
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


PLUGIN_TEMPLATE_SPECS = {
    "postgres": {
        "id": "plugin-postgres-overview",
        "name": "PostgreSQL Fleet",
        "description": "Connections, replication lag, commits, and memory across discovered PostgreSQL services.",
        "category": "plugin",
        "widget_count": 6,
        "plugin_id": "postgres",
        "service_type": "postgresql",
    },
    "mysql": {
        "id": "plugin-mysql-overview",
        "name": "MySQL Fleet",
        "description": "Threads, slow queries, bytes in/out, and uptime across discovered MySQL services.",
        "category": "plugin",
        "widget_count": 6,
        "plugin_id": "mysql",
        "service_type": "mysql",
    },
    "redis": {
        "id": "plugin-redis-overview",
        "name": "Redis Fleet",
        "description": "OPS, memory, hit rate, and connected clients for Redis instances.",
        "category": "plugin",
        "widget_count": 6,
        "plugin_id": "redis",
        "service_type": "redis",
    },
    "rabbitmq": {
        "id": "plugin-rabbitmq-overview",
        "name": "RabbitMQ Fleet",
        "description": "Queue backlog, consumers, channels, and publish/deliver rates for RabbitMQ.",
        "category": "plugin",
        "widget_count": 6,
        "plugin_id": "rabbitmq",
        "service_type": "rabbitmq",
    },
    "docker-local": {
        "id": "plugin-docker-local-overview",
        "name": "Docker Local Runtime",
        "description": "Container inventory, uptime, endpoints, and exposure for locally discovered Docker services.",
        "category": "plugin",
        "widget_count": 5,
        "plugin_id": "docker-local",
        "service_type": "docker-container",
    },
    "vordr-stack": {
        "id": "plugin-vordr-stack-overview",
        "name": "Vordr Stack",
        "description": "Aggregated health, exposure, and inventory for the Vordr platform containers on this host.",
        "category": "plugin",
        "widget_count": 6,
        "plugin_id": "vordr-stack",
        "service_type": "vordr-stack",
    },
    "web-publishing": {
        "id": "plugin-web-publishing-overview",
        "name": "Web Publishing Surfaces",
        "description": "Aggregated websites, docs, frontends, and publishing surfaces discovered on the host.",
        "category": "plugin",
        "widget_count": 5,
        "plugin_id": "web-publishing",
        "service_type": "web-publishing",
    },
    "ai-gateways": {
        "id": "plugin-ai-gateways-overview",
        "name": "AI Gateways & Models",
        "description": "Aggregated AI gateway and model-serving runtime surfaces for the host.",
        "category": "plugin",
        "widget_count": 5,
        "plugin_id": "ai-gateways",
        "service_type": "ai-gateway",
    },
    "telephony-pbx": {
        "id": "plugin-telephony-pbx-overview",
        "name": "Telephony & PBX",
        "description": "Aggregated telephony, SIP, and PBX runtime surfaces discovered on the host.",
        "category": "plugin",
        "widget_count": 5,
        "plugin_id": "telephony-pbx",
        "service_type": "telephony-pbx",
    },
    "voice-stack": {
        "id": "plugin-voice-stack-overview",
        "name": "Voice Stack",
        "description": "Aggregated TTS and speech-serving runtime surfaces discovered on the host.",
        "category": "plugin",
        "widget_count": 5,
        "plugin_id": "voice-stack",
        "service_type": "voice-stack",
    },
}

SERVICE_GROUP_TEMPLATES = {
    "web": {
        "name": "Web Surface",
        "description": "Latency, traffic, uptime, and endpoint coverage for web-facing services.",
        "widget_count": 6,
    },
    "data": {
        "name": "Data Stores",
        "description": "Operational view over database and cache services discovered in the workspace.",
        "widget_count": 6,
    },
    "messaging": {
        "name": "Messaging & Queues",
        "description": "Backlog, consumers, latency, and health for queue and message-bus style services.",
        "widget_count": 6,
    },
    "runtime": {
        "name": "Runtime Surfaces",
        "description": "Container and platform runtime services with exposure and uptime signals.",
        "widget_count": 5,
    },
    "security": {
        "name": "Security & Secrets",
        "description": "Health, request volume, and uptime for secret stores and security-facing services.",
        "widget_count": 5,
    },
    "voice": {
        "name": "Voice & AI Media",
        "description": "Specialized board for TTS/media-style services and their responsiveness.",
        "widget_count": 5,
    },
}

SERVICE_GROUP_MAP = {
    "http": "web",
    "https": "web",
    "web": "web",
    "web-app": "web",
    "api": "web",
    "postgresql": "data",
    "mysql": "data",
    "redis": "data",
    "mongodb": "data",
    "elasticsearch": "data",
    "rabbitmq": "messaging",
    "kafka": "messaging",
    "nats": "messaging",
    "docker-container": "runtime",
    "container": "runtime",
    "vault": "security",
    "tts": "voice",
}

PROFILE_TEMPLATE_SPECS = {
    "ai-gateways": {
        "name": "AI Gateways & Models",
        "description": "LLM gateways, model backends, and inference-facing containers in one operational board.",
        "widget_count": 5,
        "keywords": ["llm", "openai", "ollama", "router", "gateway", "model", "inference"],
        "category": "profiles",
    },
    "voice-stack": {
        "name": "Voice Stack",
        "description": "TTS, speech, and voice-serving containers with latency and uptime focus.",
        "widget_count": 5,
        "keywords": ["tts", "voice", "kokoro", "whisper", "speech", "audio"],
        "category": "profiles",
    },
    "telephony": {
        "name": "Telephony & PBX",
        "description": "Asterisk/PBX style runtime surfaces, ports, and uptime in one prefab board.",
        "widget_count": 5,
        "keywords": ["asterisk", "pbx", "sip", "telephony", "ivr", "call"],
        "category": "profiles",
    },
    "web-publishing": {
        "name": "Web Publishing Surfaces",
        "description": "Docs, websites, frontends, and public-ish web containers grouped together.",
        "widget_count": 5,
        "keywords": ["frontend", "website", "docs", "site", "web", "ui"],
        "category": "profiles",
    },
    "vordr-stack": {
        "name": "Vordr Stack",
        "description": "Backend, frontend, worker, plugin directory, and support services for the Vordr deployment itself.",
        "widget_count": 6,
        "keywords": ["vordr-"],
        "category": "profiles",
    },
}

BASE_TEMPLATES = [
    {
        "id": "service-catalog-overview",
        "name": "Service Catalog",
        "description": "Broad operational view across all detected services, grouped into one fast scan board.",
        "category": "core",
        "widget_count": 6,
        "preset": "Service Catalog",
    },
    {
        "id": "infra-overview",
        "name": "Infrastructure Overview",
        "description": "CPU, memory, disk, host status, and inventory across your fleet.",
        "category": "core",
        "widget_count": 8,
        "preset": "Infrastructure",
    },
    {
        "id": "services-overview",
        "name": "Service Performance",
        "description": "Latency, traffic, health, and service inventory across all discovered services.",
        "category": "core",
        "widget_count": 6,
        "preset": "API Performance",
    },
    {
        "id": "hosts-in-alert",
        "name": "Hosts in Alert",
        "description": "Focus view for hosts currently in warning or critical state.",
        "category": "operations",
        "widget_count": 7,
        "preset": "Hosts in Alert",
    },
    {
        "id": "transactions-overview",
        "name": "Transaction Health",
        "description": "Success rate, duration, and transaction status trends.",
        "category": "synthetics",
        "widget_count": 5,
        "preset": "Transaction Health",
    },
    {
        "id": "sla-overview",
        "name": "SLA Report",
        "description": "Service uptime, apdex-ish score, and transaction success rolled up for reporting.",
        "category": "reporting",
        "widget_count": 4,
        "preset": "SLA Report",
    },
]


@router.get("", response_model=list[DashboardOut])
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Dashboard).where(Dashboard.workspace_id == workspace.id).order_by(Dashboard.updated_at.desc()))
    return result.scalars().all()


@router.get("/templates", response_model=list[DashboardTemplateOut])
async def list_dashboard_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return await _build_dashboard_templates(db, workspace.id)


@router.post("", response_model=DashboardOut, status_code=201)
async def create_dashboard(
    req: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    config = req.config or {}
    widgets_count = int(config.get("widget_count") or 0)
    dashboard = Dashboard(workspace_id=workspace.id, name=req.name, type=req.type, config=config, widgets_count=widgets_count)
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.workspace_id == workspace.id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.workspace_id == workspace.id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.delete(dashboard)


@router.get("/{dashboard_id}/widgets")
async def get_dashboard_widgets(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.workspace_id == workspace.id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    config = dashboard.config or {}
    widgets = await _build_widgets(config, db, workspace.id)
    return widgets


async def _build_dashboard_templates(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    services_result = await db.execute(select(Service).where(Service.workspace_id == workspace_id).order_by(Service.name))
    services = services_result.scalars().all()

    counts_by_plugin = Counter((svc.plugin_id or "unknown") for svc in services if svc.plugin_id)
    counts_by_type = Counter((svc.service_type or "unknown") for svc in services if svc.service_type)
    counts_by_group = Counter(SERVICE_GROUP_MAP.get((svc.service_type or "").lower()) for svc in services if SERVICE_GROUP_MAP.get((svc.service_type or "").lower()))
    counts_by_profile = {profile_id: len(_profile_services(services, profile_id)) for profile_id in PROFILE_TEMPLATE_SPECS}

    templates: list[dict] = []
    for spec in BASE_TEMPLATES:
        templates.append({
            **spec,
            "available_count": len(services),
            "recommended": spec["id"] in {"infra-overview", "services-overview", "service-catalog-overview"},
            "plugin_id": None,
            "service_type": None,
            "service_group": None,
        })

    for group_id, group_spec in SERVICE_GROUP_TEMPLATES.items():
        available_count = counts_by_group.get(group_id, 0)
        if available_count <= 0:
            continue
        templates.append({
            "id": f"service-group-{group_id}",
            "name": group_spec["name"],
            "description": group_spec["description"],
            "category": "service-group",
            "widget_count": group_spec["widget_count"],
            "available_count": available_count,
            "recommended": available_count >= 2,
            "plugin_id": None,
            "service_type": None,
            "service_group": group_id,
            "profile": None,
            "preset": f"service-group:{group_id}",
        })

    for profile_id, profile_spec in PROFILE_TEMPLATE_SPECS.items():
        available_count = counts_by_profile.get(profile_id, 0)
        if available_count <= 0:
            continue
        templates.append({
            "id": f"profile-{profile_id}",
            "name": profile_spec["name"],
            "description": profile_spec["description"],
            "category": "profiles",
            "widget_count": profile_spec["widget_count"],
            "available_count": available_count,
            "recommended": available_count >= 2,
            "plugin_id": None,
            "service_type": None,
            "service_group": None,
            "profile": profile_id,
            "preset": f"profile:{profile_id}",
        })

    for plugin_id, spec in PLUGIN_TEMPLATE_SPECS.items():
        available_count = counts_by_plugin.get(plugin_id, 0)
        if available_count <= 0:
            continue
        templates.append({
            **spec,
            "available_count": available_count,
            "recommended": available_count > 0,
            "service_group": SERVICE_GROUP_MAP.get((spec.get("service_type") or "").lower()),
            "profile": None,
        })

    for service_type, count in counts_by_type.items():
        if count <= 0 or service_type in {spec.get("service_type") for spec in PLUGIN_TEMPLATE_SPECS.values()}:
            continue
        pretty = service_type.replace("-", " ").replace("_", " ").title()
        templates.append({
            "id": f"service-type-{service_type}",
            "name": f"{pretty} Services",
            "description": f"Template focused on {pretty.lower()} latency, uptime, traffic, and inventory.",
            "category": "service-type",
            "widget_count": 5,
            "available_count": count,
            "recommended": count >= 2,
            "plugin_id": None,
            "service_type": service_type,
            "service_group": SERVICE_GROUP_MAP.get(service_type.lower()),
            "profile": None,
            "preset": f"service-type:{service_type}",
        })

    templates.sort(key=lambda item: (not item.get("recommended", False), -item.get("available_count", 0), item["name"]))
    return templates


async def _build_widgets(config: dict, db: AsyncSession, workspace_id: UUID) -> list[dict]:
    preset = str(config.get("preset") or config.get("template_id") or config.get("prompt") or "Infrastructure")
    plugin_id = config.get("plugin_id")
    service_type = config.get("service_type")
    service_group = config.get("service_group")
    profile = config.get("profile")

    if plugin_id:
        return await _plugin_widgets(db, workspace_id, plugin_id)
    if service_type:
        return await _service_subset_widgets(db, workspace_id, service_type=service_type)
    if service_group:
        return await _service_group_widgets(db, workspace_id, service_group)
    if profile:
        return await _profile_widgets(db, workspace_id, profile)
    if "Alert" in preset or "alert" in preset:
        return await _alert_hosts_widgets(db, workspace_id)
    if "Infrastructure" in preset:
        return await _infra_widgets(db, workspace_id)
    if "API" in preset or "Performance" in preset or "Service" in preset:
        return await _api_widgets(db, workspace_id)
    if "Transaction" in preset:
        return await _tx_widgets(db, workspace_id)
    if "Database" in preset:
        return await _db_widgets(db, workspace_id)
    if "Network" in preset:
        return await _network_widgets(db, workspace_id)
    if "SLA" in preset:
        return await _sla_widgets(db, workspace_id)
    return await _infra_widgets(db, workspace_id)


def _ts_range(points: int = 24):
    now = datetime.now(timezone.utc)
    return [now - timedelta(hours=points - 1 - i) for i in range(points)]


def _fmt(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def _service_metric(service: Service, key: str, fallback: float = 0.0) -> float:
    meta = service.plugin_metadata or {}
    value = meta.get(key, fallback)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(fallback)


def _matches_profile(service: Service, keywords: list[str]) -> bool:
    haystack = " ".join(
        [
            service.name or "",
            service.plugin_id or "",
            service.service_type or "",
            service.endpoint or "",
            service.url or "",
        ]
    ).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def _profile_services(services: list[Service], profile: str) -> list[Service]:
    spec = PROFILE_TEMPLATE_SPECS.get(profile)
    if not spec:
        return []
    return [service for service in services if _matches_profile(service, spec.get("keywords", []))]


def _service_label(service: Service) -> str:
    if service.plugin_id:
        return f"{service.name}"
    return service.name


def _build_series(nodes: list[Service], metric_fn, points: int = 24, spread: float = 0.15, floor: float = 0):
    ts = _ts_range(points)
    series = []
    for i, svc in enumerate(nodes):
        current = metric_fn(svc)
        variance = max(abs(current) * spread, 1)
        data = []
        for idx, t in enumerate(ts):
            wave = math.sin((idx + 1 + i) / 3)
            value = max(floor, current + random.uniform(-variance, variance) * wave)
            data.append({"time": _fmt(t), "value": round(value, 2)})
        series.append({
            "id": str(svc.id),
            "name": _service_label(svc),
            "status": svc.status,
            "plugin_id": svc.plugin_id,
            "service_type": svc.service_type,
            "host_id": str(svc.host_id) if svc.host_id else None,
            "endpoint": svc.endpoint,
            "current": round(current, 2),
            "data": data,
        })
    return series


def _service_status_counts(services: list[Service]) -> dict[str, int]:
    counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for svc in services:
        counts[svc.status] = counts.get(svc.status, 0) + 1
    return counts


def _service_rows(services: list[Service]) -> list[dict]:
    rows = []
    for svc in services:
        meta = svc.plugin_metadata or {}
        rows.append({
            "id": str(svc.id),
            "name": svc.name,
            "status": svc.status,
            "plugin": svc.plugin_id or "—",
            "type": svc.service_type or "—",
            "latency": round(svc.latency_ms or 0, 1),
            "traffic": round(svc.requests_per_min or 0, 0),
            "uptime": round(svc.uptime_percent or 0, 1),
            "endpoint": svc.endpoint or svc.url or "—",
            "mode": meta.get("metrics_mode") or meta.get("source") or "live",
        })
    return rows


async def _service_subset_widgets(db: AsyncSession, workspace_id: UUID, plugin_id: str | None = None, service_type: str | None = None) -> list[dict]:
    stmt = select(Service).where(Service.workspace_id == workspace_id)
    if plugin_id:
        stmt = stmt.where(Service.plugin_id == plugin_id)
    if service_type:
        stmt = stmt.where(Service.service_type == service_type)
    result = await db.execute(stmt.order_by(Service.name))
    services = result.scalars().all()
    if not services:
        return [{"id": "empty", "type": "table", "title": "No matching services", "size": "full", "rows": []}]

    latency_nodes = _build_series(services, lambda svc: float(svc.latency_ms or 0), spread=0.2, floor=0)
    traffic_nodes = _build_series(services, lambda svc: float(svc.requests_per_min or 0), spread=0.25, floor=0)
    uptime_nodes = _build_series(services, lambda svc: float(svc.uptime_percent or 0), spread=0.01, floor=90)
    status_counts = _service_status_counts(services)

    scope_name = plugin_id or service_type or "services"
    return [
        {"id": "subset-stats", "type": "stat_row", "title": f"{scope_name} Summary", "size": "full", "stats": [
            {"label": "Services", "value": len(services)},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
            {"label": "Avg Latency", "value": f"{round(sum(float(s.latency_ms or 0) for s in services) / max(len(services), 1), 0)}ms"},
            {"label": "Total Traffic", "value": round(sum(float(s.requests_per_min or 0) for s in services), 0)},
        ]},
        {"id": "subset-latency", "type": "line_chart", "title": "Latency Trend", "size": "large", "nodes": latency_nodes},
        {"id": "subset-traffic", "type": "area_chart", "title": "Traffic Trend", "size": "large", "nodes": traffic_nodes},
        {"id": "subset-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "subset-uptime", "type": "gauge_grid", "title": "Current Uptime", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in uptime_nodes]},
        {"id": "subset-table", "type": "table", "title": "Service Inventory", "size": "full", "rows": _service_rows(services)},
    ]


async def _service_group_widgets(db: AsyncSession, workspace_id: UUID, service_group: str) -> list[dict]:
    service_types = [service_type for service_type, group in SERVICE_GROUP_MAP.items() if group == service_group]
    if not service_types:
        return [{"id": "empty-group", "type": "table", "title": "No matching services", "size": "full", "rows": []}]

    result = await db.execute(
        select(Service).where(Service.workspace_id == workspace_id, Service.service_type.in_(service_types)).order_by(Service.name)
    )
    services = result.scalars().all()
    if not services:
        return [{"id": "empty-group", "type": "table", "title": "No matching services", "size": "full", "rows": []}]

    widgets = await _service_subset_widgets(db, workspace_id)
    widgets = [widget.copy() for widget in widgets]

    label = SERVICE_GROUP_TEMPLATES.get(service_group, {}).get("name", service_group.title())
    for widget in widgets:
        if widget.get("type") == "stat_row":
            widget["title"] = f"{label} Summary"
            widget["stats"][0]["label"] = label
        elif widget.get("title") == "Latency Trend":
            widget["title"] = f"{label} Latency"
        elif widget.get("title") == "Traffic Trend":
            widget["title"] = f"{label} Traffic"
        elif widget.get("title") == "Health Breakdown":
            widget["title"] = f"{label} Health"
        elif widget.get("title") == "Current Uptime":
            widget["title"] = f"{label} Uptime"
        elif widget.get("title") == "Service Inventory":
            widget["title"] = f"{label} Inventory"

    return await _service_subset_widgets(db, workspace_id, service_type=None) if False else [
        {**widget} for widget in [
            {"id": "group-stats", "type": "stat_row", "title": f"{label} Summary", "size": "full", "stats": [
                {"label": label, "value": len(services)},
                {"label": "Healthy", "value": _service_status_counts(services).get("healthy", 0)},
                {"label": "Avg Latency", "value": f"{round(sum(float(s.latency_ms or 0) for s in services) / max(len(services), 1), 0)}ms"},
                {"label": "Total Traffic", "value": round(sum(float(s.requests_per_min or 0) for s in services), 0)},
            ]},
            {"id": "group-latency", "type": "line_chart", "title": f"{label} Latency", "size": "large", "nodes": _build_series(services, lambda svc: float(svc.latency_ms or 0), spread=0.2, floor=0)},
            {"id": "group-traffic", "type": "area_chart", "title": f"{label} Traffic", "size": "large", "nodes": _build_series(services, lambda svc: float(svc.requests_per_min or 0), spread=0.25, floor=0)},
            {"id": "group-health", "type": "pie_chart", "title": f"{label} Health", "size": "small", "data": [{"name": k, "value": v} for k, v in _service_status_counts(services).items() if v > 0]},
            {"id": "group-uptime", "type": "gauge_grid", "title": f"{label} Uptime", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in _build_series(services, lambda svc: float(svc.uptime_percent or 0), spread=0.01, floor=90)]},
            {"id": "group-table", "type": "table", "title": f"{label} Inventory", "size": "full", "rows": _service_rows(services)},
        ]
    ]


async def _profile_widgets(db: AsyncSession, workspace_id: UUID, profile: str) -> list[dict]:
    result = await db.execute(select(Service).where(Service.workspace_id == workspace_id).order_by(Service.name))
    all_services = result.scalars().all()
    services = _profile_services(all_services, profile)
    if not services:
        return [{"id": "empty-profile", "type": "table", "title": "No matching services", "size": "full", "rows": []}]

    profile_spec = PROFILE_TEMPLATE_SPECS.get(profile, {})
    label = profile_spec.get("name", profile.replace("-", " ").title())
    status_counts = _service_status_counts(services)
    latency_nodes = _build_series(services, lambda svc: float(svc.latency_ms or 0), spread=0.2, floor=0)
    traffic_nodes = _build_series(services, lambda svc: float(svc.requests_per_min or 0), spread=0.25, floor=0)
    uptime_nodes = _build_series(services, lambda svc: float(svc.uptime_percent or 0), spread=0.01, floor=85)

    exposed_count = sum(1 for svc in services if svc.endpoint and "->" in (svc.endpoint or ""))
    return [
        {"id": "profile-stats", "type": "stat_row", "title": f"{label} Summary", "size": "full", "stats": [
            {"label": "Services", "value": len(services)},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
            {"label": "Exposed", "value": exposed_count},
            {"label": "Avg Latency", "value": f"{round(sum(float(s.latency_ms or 0) for s in services) / max(len(services), 1), 0)}ms"},
        ]},
        {"id": "profile-latency", "type": "line_chart", "title": f"{label} Latency", "size": "large", "nodes": latency_nodes},
        {"id": "profile-traffic", "type": "area_chart", "title": f"{label} Traffic", "size": "large", "nodes": traffic_nodes},
        {"id": "profile-uptime", "type": "gauge_grid", "title": f"{label} Uptime", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in uptime_nodes]},
        {"id": "profile-health", "type": "pie_chart", "title": f"{label} Health", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "profile-table", "type": "table", "title": f"{label} Inventory", "size": "full", "rows": _service_rows(services)},
    ]


async def _plugin_widgets(db: AsyncSession, workspace_id: UUID, plugin_id: str) -> list[dict]:
    result = await db.execute(select(Service).where(Service.workspace_id == workspace_id, Service.plugin_id == plugin_id).order_by(Service.name))
    services = result.scalars().all()
    if not services:
        return await _service_subset_widgets(db, workspace_id, plugin_id=plugin_id)

    status_counts = _service_status_counts(services)

    if plugin_id == "postgres":
        connection_nodes = _build_series(services, lambda svc: _service_metric(svc, "total_connections"), spread=0.15)
        util_nodes = _build_series(services, lambda svc: _service_metric(svc, "connection_utilization") * 100, spread=0.08)
        lag_nodes = _build_series(services, lambda svc: _service_metric(svc, "replication_lag_seconds"), spread=0.35)
        return [
            {"id": "pg-stats", "type": "stat_row", "title": "PostgreSQL Summary", "size": "full", "stats": [
                {"label": "Instances", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "Total Conns", "value": round(sum(_service_metric(s, "total_connections") for s in services), 0)},
                {"label": "Avg Lag", "value": f"{round(sum(_service_metric(s, 'replication_lag_seconds') for s in services) / max(len(services),1), 1)}s"},
            ]},
            {"id": "pg-conns", "type": "area_chart", "title": "Connections", "size": "large", "nodes": connection_nodes},
            {"id": "pg-util", "type": "gauge_grid", "title": "Connection Utilization", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in util_nodes]},
            {"id": "pg-lag", "type": "line_chart", "title": "Replication Lag", "size": "large", "nodes": lag_nodes},
            {"id": "pg-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "pg-table", "type": "table", "title": "PostgreSQL Services", "size": "full", "rows": _service_rows(services)},
        ]

    if plugin_id == "mysql":
        threads_nodes = _build_series(services, lambda svc: _service_metric(svc, "threads_connected"), spread=0.15)
        slow_nodes = _build_series(services, lambda svc: _service_metric(svc, "slow_queries"), spread=0.35)
        qps_nodes = _build_series(services, lambda svc: _service_metric(svc, "queries_per_sec", _service_metric(svc, "xact_commit")), spread=0.2)
        return [
            {"id": "mysql-stats", "type": "stat_row", "title": "MySQL Summary", "size": "full", "stats": [
                {"label": "Instances", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "Threads", "value": round(sum(_service_metric(s, "threads_connected") for s in services), 0)},
                {"label": "Slow Queries", "value": round(sum(_service_metric(s, "slow_queries") for s in services), 0)},
            ]},
            {"id": "mysql-threads", "type": "area_chart", "title": "Connected Threads", "size": "large", "nodes": threads_nodes},
            {"id": "mysql-qps", "type": "line_chart", "title": "Query Throughput", "size": "large", "nodes": qps_nodes},
            {"id": "mysql-slow", "type": "gauge_grid", "title": "Slow Queries", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "slow"} for n in slow_nodes]},
            {"id": "mysql-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "mysql-table", "type": "table", "title": "MySQL Services", "size": "full", "rows": _service_rows(services)},
        ]

    if plugin_id == "redis":
        ops_nodes = _build_series(services, lambda svc: _service_metric(svc, "instantaneous_ops_per_sec"), spread=0.2)
        mem_nodes = _build_series(services, lambda svc: _service_metric(svc, "used_memory"), spread=0.15)
        clients_nodes = _build_series(services, lambda svc: _service_metric(svc, "connected_clients"), spread=0.15)
        return [
            {"id": "redis-stats", "type": "stat_row", "title": "Redis Summary", "size": "full", "stats": [
                {"label": "Instances", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "OPS/sec", "value": round(sum(_service_metric(s, "instantaneous_ops_per_sec") for s in services), 0)},
                {"label": "Clients", "value": round(sum(_service_metric(s, "connected_clients") for s in services), 0)},
            ]},
            {"id": "redis-ops", "type": "line_chart", "title": "Operations Per Second", "size": "large", "nodes": ops_nodes},
            {"id": "redis-memory", "type": "gauge_grid", "title": "Used Memory", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "bytes"} for n in mem_nodes]},
            {"id": "redis-clients", "type": "area_chart", "title": "Connected Clients", "size": "large", "nodes": clients_nodes},
            {"id": "redis-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "redis-table", "type": "table", "title": "Redis Services", "size": "full", "rows": _service_rows(services)},
        ]

    if plugin_id == "rabbitmq":
        ready_nodes = _build_series(services, lambda svc: _service_metric(svc, "messages_ready"), spread=0.25)
        unacked_nodes = _build_series(services, lambda svc: _service_metric(svc, "messages_unacknowledged"), spread=0.25)
        consumer_nodes = _build_series(services, lambda svc: _service_metric(svc, "consumer_count"), spread=0.15)
        return [
            {"id": "rmq-stats", "type": "stat_row", "title": "RabbitMQ Summary", "size": "full", "stats": [
                {"label": "Instances", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "Ready Msgs", "value": round(sum(_service_metric(s, "messages_ready") for s in services), 0)},
                {"label": "Consumers", "value": round(sum(_service_metric(s, "consumer_count") for s in services), 0)},
            ]},
            {"id": "rmq-ready", "type": "area_chart", "title": "Messages Ready", "size": "large", "nodes": ready_nodes},
            {"id": "rmq-unacked", "type": "line_chart", "title": "Messages Unacked", "size": "large", "nodes": unacked_nodes},
            {"id": "rmq-consumers", "type": "gauge_grid", "title": "Consumers", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "consumers"} for n in consumer_nodes]},
            {"id": "rmq-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "rmq-table", "type": "table", "title": "RabbitMQ Services", "size": "full", "rows": _service_rows(services)},
        ]

    if plugin_id == "docker-local":
        uptime_nodes = _build_series(services, lambda svc: float(svc.uptime_percent or 0), spread=0.02, floor=85)
        traffic_nodes = _build_series(services, lambda svc: float(svc.requests_per_min or 0), spread=0.35, floor=0)
        return [
            {"id": "docker-stats", "type": "stat_row", "title": "Docker Runtime Summary", "size": "full", "stats": [
                {"label": "Containers", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "Exposed", "value": sum(1 for s in services if s.endpoint and ":" in s.endpoint)},
                {"label": "Endpoints", "value": sum(int(s.endpoints_count or 0) for s in services)},
            ]},
            {"id": "docker-uptime", "type": "gauge_grid", "title": "Container Uptime", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in uptime_nodes]},
            {"id": "docker-traffic", "type": "area_chart", "title": "Container Traffic", "size": "large", "nodes": traffic_nodes},
            {"id": "docker-health", "type": "pie_chart", "title": "Health Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "docker-table", "type": "table", "title": "Container Inventory", "size": "full", "rows": _service_rows(services)},
        ]

    if plugin_id in {"vordr-stack", "web-publishing", "ai-gateways", "telephony-pbx", "voice-stack"}:
        profile_labels = {
            "vordr-stack": "Vordr Stack",
            "web-publishing": "Web Publishing",
            "ai-gateways": "AI Gateways",
            "telephony-pbx": "Telephony & PBX",
            "voice-stack": "Voice Stack",
        }
        label = profile_labels.get(plugin_id, plugin_id)
        table_rows = _service_rows(services)
        exposed = sum(1 for s in services if s.endpoint and s.endpoint != "—")
        return [
            {"id": "stack-stats", "type": "stat_row", "title": f"{label} Summary", "size": "full", "stats": [
                {"label": "Services", "value": len(services)},
                {"label": "Healthy", "value": status_counts.get("healthy", 0)},
                {"label": "Exposed", "value": exposed},
                {"label": "Endpoints", "value": sum(int(s.endpoints_count or 0) for s in services)},
            ]},
            {"id": "stack-health", "type": "pie_chart", "title": f"{label} Health", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
            {"id": "stack-uptime", "type": "gauge_grid", "title": f"{label} Uptime", "size": "medium", "nodes": [{"id": s["id"], "name": s["name"], "status": s["status"], "value": s["uptime"], "label": "%"} for s in table_rows]},
            {"id": "stack-inventory", "type": "table", "title": f"{label} Inventory", "size": "full", "rows": table_rows},
        ]

    return await _service_subset_widgets(db, workspace_id, plugin_id=plugin_id)


async def _infra_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    hosts_result = await db.execute(select(Host).where(Host.workspace_id == workspace_id).order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    cpu_series = []
    for h in hosts:
        base = h.cpu_percent
        cpu_series.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-12, 8) * math.sin(i / 3))), 1)} for i, t in enumerate(ts)],
        })

    mem_series = []
    for h in hosts:
        base = h.memory_percent
        mem_series.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-5, 5))), 1)} for i, t in enumerate(ts)],
        })

    disk_nodes = []
    for h in hosts:
        disk_nodes.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(h.disk_percent, 1),
            "data": [{"time": _fmt(t), "value": round(h.disk_percent + random.uniform(-1, 1), 1)} for t in ts],
        })

    status_counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for h in hosts:
        status_counts[h.status] = status_counts.get(h.status, 0) + 1

    host_table = []
    for h in hosts:
        host_table.append({
            "id": str(h.id),
            "name": h.name,
            "type": h.type,
            "status": h.status,
            "ip": h.ip_address,
            "cpu": round(h.cpu_percent, 1),
            "mem": round(h.memory_percent, 1),
            "disk": round(h.disk_percent, 1),
            "uptime": h.uptime or "N/A",
            "os": h.os or "N/A",
            "tags": h.tags or [],
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "CPU Usage Over Time", "size": "large", "nodes": cpu_series},
        {"id": "w2", "type": "line_chart", "title": "Memory Usage Over Time", "size": "large", "nodes": mem_series},
        {"id": "w3", "type": "bar_chart", "title": "Disk Usage by Host", "size": "medium", "nodes": disk_nodes},
        {"id": "w4", "type": "pie_chart", "title": "Host Status Distribution", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w5", "type": "gauge_grid", "title": "Current CPU", "size": "medium", "nodes": [{"id": s["id"], "name": s["name"], "status": s["status"], "value": s["current"], "label": "CPU %"} for s in cpu_series]},
        {"id": "w6", "type": "gauge_grid", "title": "Current Memory", "size": "medium", "nodes": [{"id": s["id"], "name": s["name"], "status": s["status"], "value": s["current"], "label": "MEM %"} for s in mem_series]},
        {"id": "w7", "type": "stat_row", "title": "Quick Stats", "size": "full", "stats": [
            {"label": "Total Hosts", "value": len(hosts)},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
            {"label": "Warning", "value": status_counts.get("warning", 0)},
            {"label": "Critical", "value": status_counts.get("critical", 0)},
        ]},
        {"id": "w8", "type": "table", "title": "Host Inventory", "size": "full", "rows": host_table},
    ]


async def _api_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    svcs_result = await db.execute(select(Service).where(Service.workspace_id == workspace_id).order_by(Service.name))
    svcs = svcs_result.scalars().all()
    ts = _ts_range(24)

    latency_nodes = []
    for s in svcs:
        base = s.latency_ms
        latency_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(1, base + random.uniform(-20, 20) * math.sin(i / 4)), 1)} for i, t in enumerate(ts)],
        })

    rps_nodes = []
    for s in svcs:
        base = s.requests_per_min
        rps_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base, 0),
            "data": [{"time": _fmt(t), "value": round(max(0, base + random.uniform(-200, 200)), 0)} for i, t in enumerate(ts)],
        })

    error_nodes = []
    for s in svcs:
        base_err = 100 - s.uptime_percent
        error_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base_err, 2),
            "data": [{"time": _fmt(t), "value": round(max(0, base_err + random.uniform(-0.5, 0.5)), 2)} for i, t in enumerate(ts)],
        })

    svc_table = []
    for s in svcs:
        svc_table.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "latency": round(s.latency_ms, 1), "uptime": s.uptime_percent,
            "rps": round(s.requests_per_min, 0), "endpoints": s.endpoints_count,
            "plugin": s.plugin_id or "—", "type": s.service_type or "—",
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "Response Latency (ms)", "size": "large", "nodes": latency_nodes},
        {"id": "w2", "type": "area_chart", "title": "Requests per Minute", "size": "large", "nodes": rps_nodes},
        {"id": "w3", "type": "line_chart", "title": "Error Rate (%)", "size": "medium", "nodes": error_nodes},
        {"id": "w4", "type": "gauge_grid", "title": "Current Latency", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "ms"} for n in latency_nodes]},
        {"id": "w5", "type": "stat_row", "title": "Service Overview", "size": "full", "stats": [
            {"label": "Total Services", "value": len(svcs)},
            {"label": "Avg Latency", "value": f"{round(sum(s.latency_ms for s in svcs) / max(len(svcs),1), 0)}ms"},
            {"label": "Total RPM", "value": f"{round(sum(s.requests_per_min for s in svcs), 0)}"},
            {"label": "Healthy", "value": sum(1 for s in svcs if s.status == "healthy")},
        ]},
        {"id": "w6", "type": "table", "title": "Service Details", "size": "full", "rows": svc_table},
    ]


async def _tx_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    txs_result = await db.execute(select(Transaction).where(Transaction.workspace_id == workspace_id).order_by(Transaction.name))
    txs = txs_result.scalars().all()
    ts = _ts_range(24)

    success_nodes = []
    for tx in txs:
        base = tx.success_rate
        success_nodes.append({
            "id": str(tx.id), "name": tx.name, "status": tx.status,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(80, min(100, base + random.uniform(-2, 1))), 1)} for i, t in enumerate(ts)],
        })

    dur_nodes = []
    for tx in txs:
        base = tx.avg_duration_ms
        dur_nodes.append({
            "id": str(tx.id), "name": tx.name, "status": tx.status,
            "current": round(base, 0),
            "data": [{"time": _fmt(t), "value": round(max(50, base + random.uniform(-300, 300)), 0)} for i, t in enumerate(ts)],
        })

    status_counts = {"healthy": 0, "warning": 0, "critical": 0}
    for tx in txs:
        status_counts[tx.status] = status_counts.get(tx.status, 0) + 1

    return [
        {"id": "w1", "type": "line_chart", "title": "Success Rate Over Time (%)", "size": "large", "nodes": success_nodes},
        {"id": "w2", "type": "area_chart", "title": "Duration Over Time (ms)", "size": "large", "nodes": dur_nodes},
        {"id": "w3", "type": "pie_chart", "title": "Transaction Health", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w4", "type": "gauge_grid", "title": "Current Success Rates", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in success_nodes]},
        {"id": "w5", "type": "stat_row", "title": "Transaction Summary", "size": "full", "stats": [
            {"label": "Total Monitors", "value": len(txs)},
            {"label": "Avg Success", "value": f"{round(sum(tx.success_rate for tx in txs) / max(len(txs),1), 1)}%"},
            {"label": "Avg Duration", "value": f"{round(sum(tx.avg_duration_ms for tx in txs) / max(len(txs),1), 0)}ms"},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
        ]},
    ]


async def _db_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    hosts_result = await db.execute(select(Host).where(Host.workspace_id == workspace_id, Host.type == "database").order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    cpu_nodes = []
    for h in hosts:
        base = h.cpu_percent
        cpu_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": "database", "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-10, 10))), 1)} for i, t in enumerate(ts)],
        })

    conn_nodes = []
    for h in hosts:
        base_conn = random.randint(30, 180)
        conn_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": base_conn,
            "data": [{"time": _fmt(t), "value": max(0, base_conn + random.randint(-20, 20))} for t in ts],
        })

    query_nodes = []
    for h in hosts:
        base_qps = random.randint(500, 3000)
        query_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": base_qps,
            "data": [{"time": _fmt(t), "value": max(0, base_qps + random.randint(-500, 500))} for t in ts],
        })

    repl_data = [{"time": _fmt(t), "value": round(random.uniform(0, 8), 1)} for t in ts]

    return [
        {"id": "w1", "type": "line_chart", "title": "Database CPU Usage", "size": "large", "nodes": cpu_nodes},
        {"id": "w2", "type": "area_chart", "title": "Active Connections", "size": "large", "nodes": conn_nodes},
        {"id": "w3", "type": "line_chart", "title": "Queries Per Second", "size": "medium", "nodes": query_nodes},
        {"id": "w4", "type": "line_chart", "title": "Replication Lag (s)", "size": "medium", "nodes": [{"id": "repl", "name": "Replication Lag", "status": "warning", "current": repl_data[-1]["value"], "data": repl_data}]},
        {"id": "w5", "type": "gauge_grid", "title": "Current CPU", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "CPU %"} for n in cpu_nodes]},
        {"id": "w6", "type": "stat_row", "title": "Database Summary", "size": "full", "stats": [
            {"label": "DB Hosts", "value": len(hosts)},
            {"label": "Avg CPU", "value": f"{round(sum(h.cpu_percent for h in hosts) / max(len(hosts),1), 0)}%"},
            {"label": "Avg Memory", "value": f"{round(sum(h.memory_percent for h in hosts) / max(len(hosts),1), 0)}%"},
            {"label": "Healthy", "value": sum(1 for h in hosts if h.status == "healthy")},
        ]},
        {"id": "w7", "type": "table", "title": "Database Hosts", "size": "full", "rows": [{"id": str(h.id), "name": h.name, "status": h.status, "cpu": round(h.cpu_percent, 1), "mem": round(h.memory_percent, 1), "disk": round(h.disk_percent, 1), "uptime": h.uptime or "N/A"} for h in hosts]},
    ]


async def _network_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    hosts_result = await db.execute(select(Host).where(Host.workspace_id == workspace_id).order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    bw_in_nodes, bw_out_nodes = [], []
    for h in hosts[:6]:
        base_in = random.uniform(10, 500)
        base_out = random.uniform(5, 200)
        bw_in_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": round(base_in, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, base_in + random.uniform(-50, 50)), 1)} for t in ts],
        })
        bw_out_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": round(base_out, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, base_out + random.uniform(-30, 30)), 1)} for t in ts],
        })

    packet_loss = [{"time": _fmt(t), "value": round(random.uniform(0, 0.5), 3)} for t in ts]

    return [
        {"id": "w1", "type": "area_chart", "title": "Bandwidth In (MB/s)", "size": "large", "nodes": bw_in_nodes},
        {"id": "w2", "type": "area_chart", "title": "Bandwidth Out (MB/s)", "size": "large", "nodes": bw_out_nodes},
        {"id": "w3", "type": "line_chart", "title": "Packet Loss (%)", "size": "medium", "nodes": [{"id": "pkt", "name": "Packet Loss", "status": "healthy", "current": packet_loss[-1]["value"], "data": packet_loss}]},
        {"id": "w4", "type": "stat_row", "title": "Network Overview", "size": "full", "stats": [
            {"label": "Monitored Hosts", "value": len(hosts)},
            {"label": "Avg BW In", "value": f"{round(sum(n['current'] for n in bw_in_nodes) / max(len(bw_in_nodes),1), 0)} MB/s"},
            {"label": "Avg BW Out", "value": f"{round(sum(n['current'] for n in bw_out_nodes) / max(len(bw_out_nodes),1), 0)} MB/s"},
            {"label": "Packet Loss", "value": f"{packet_loss[-1]['value']}%"},
        ]},
    ]


async def _sla_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    svcs_result = await db.execute(select(Service).where(Service.workspace_id == workspace_id).order_by(Service.name))
    svcs = svcs_result.scalars().all()
    txs_result = await db.execute(select(Transaction).where(Transaction.workspace_id == workspace_id).order_by(Transaction.name))
    txs = txs_result.scalars().all()
    ts = _ts_range(24)

    uptime_nodes = []
    for s in svcs:
        uptime_nodes.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "current": s.uptime_percent,
            "data": [{"time": _fmt(t), "value": round(max(95, min(100, s.uptime_percent + random.uniform(-0.5, 0.2))), 2)} for t in ts],
        })

    apdex_nodes = []
    for s in svcs:
        base_apdex = 1.0 - (s.latency_ms / 1000)
        base_apdex = max(0.5, min(1.0, base_apdex))
        apdex_nodes.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "current": round(base_apdex, 2),
            "data": [{"time": _fmt(t), "value": round(max(0.5, min(1.0, base_apdex + random.uniform(-0.05, 0.03))), 2)} for t in ts],
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "Service Uptime (%)", "size": "large", "nodes": uptime_nodes},
        {"id": "w2", "type": "line_chart", "title": "Apdex Score", "size": "large", "nodes": apdex_nodes},
        {"id": "w3", "type": "gauge_grid", "title": "Current SLA", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in uptime_nodes]},
        {"id": "w4", "type": "stat_row", "title": "SLA Summary", "size": "full", "stats": [
            {"label": "Services", "value": len(svcs)},
            {"label": "Avg Uptime", "value": f"{round(sum(s.uptime_percent for s in svcs) / max(len(svcs),1), 2)}%"},
            {"label": "Transactions", "value": len(txs)},
            {"label": "Avg TX Success", "value": f"{round(sum(tx.success_rate for tx in txs) / max(len(txs),1), 1)}%"},
        ]},
    ]


async def _alert_hosts_widgets(db: AsyncSession, workspace_id: UUID) -> list[dict]:
    hosts_result = await db.execute(
        select(Host).where(Host.workspace_id == workspace_id, Host.status.in_(["warning", "critical"])).order_by(Host.status.desc(), Host.name)
    )
    alert_hosts = hosts_result.scalars().all()

    all_result = await db.execute(select(Host).where(Host.workspace_id == workspace_id))
    all_hosts = all_result.scalars().all()
    ts = _ts_range(24)

    alerts_result = await db.execute(
        select(AlertInstance).where(AlertInstance.workspace_id == workspace_id, AlertInstance.resolved == False).order_by(AlertInstance.created_at.desc()).limit(20)
    )
    active_alerts = alerts_result.scalars().all()

    status_counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for h in all_hosts:
        status_counts[h.status] = status_counts.get(h.status, 0) + 1

    cpu_nodes = []
    for h in alert_hosts:
        base = h.cpu_percent
        cpu_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": h.type, "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-15, 10) * math.sin(i / 3))), 1)} for i, t in enumerate(ts)],
        })

    mem_nodes = []
    for h in alert_hosts:
        base = h.memory_percent
        mem_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": h.type, "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-8, 8))), 1)} for i, t in enumerate(ts)],
        })

    host_table = []
    for h in alert_hosts:
        host_table.append({
            "id": str(h.id), "name": h.name, "type": h.type,
            "status": h.status, "ip": h.ip_address or "N/A",
            "cpu": round(h.cpu_percent, 1), "mem": round(h.memory_percent, 1),
            "disk": round(h.disk_percent, 1), "uptime": h.uptime or "N/A",
        })

    alert_table = []
    for a in active_alerts:
        alert_table.append({
            "id": str(a.id), "name": a.message or "Alert",
            "severity": a.severity,
            "status": "acknowledged" if a.acknowledged else "firing",
            "fired": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
        })

    widgets = [
        {"id": "w1", "type": "stat_row", "title": "Alert Summary", "size": "full", "stats": [
            {"label": "Total Hosts", "value": len(all_hosts)},
            {"label": "In Alert", "value": len(alert_hosts)},
            {"label": "Warning", "value": status_counts.get("warning", 0)},
            {"label": "Critical", "value": status_counts.get("critical", 0)},
        ]},
        {"id": "w2", "type": "pie_chart", "title": "Host Status Breakdown", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w3", "type": "gauge_grid", "title": "Alerting Host CPU", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "CPU %"} for n in cpu_nodes]},
    ]

    if cpu_nodes:
        widgets.append({"id": "w4", "type": "line_chart", "title": "CPU Trend (Alerting Hosts)", "size": "large", "nodes": cpu_nodes})
    if mem_nodes:
        widgets.append({"id": "w5", "type": "area_chart", "title": "Memory Trend (Alerting Hosts)", "size": "large", "nodes": mem_nodes})

    widgets.append({"id": "w6", "type": "table", "title": "Hosts in Alert", "size": "full", "rows": host_table})

    if alert_table:
        widgets.append({"id": "w7", "type": "table", "title": "Active Alerts", "size": "full", "rows": alert_table})

    return widgets
