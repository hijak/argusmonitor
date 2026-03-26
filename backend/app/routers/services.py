import asyncio
import json
import socket
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token, get_current_user
from app.database import async_session, get_db
from app.models import AlertRule, Host, Monitor, Service, ServiceMetric, User, Workspace, WorkspaceMembership
from app.schemas import ServiceCreate, ServiceListResponse, ServiceMetricPointOut, ServiceOut, ServiceUpdate, ServiceWithSparkline
from app.services.alert_rules import evaluate_service_alert_rules
from app.services.service_metrics import build_service_metric, fetch_latest_service_metrics, should_record_service_metric
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/services", tags=["services"])
STREAM_INTERVAL_SECONDS = 10
PROFILE_HINTS_BY_SERVICE_TYPE = {
    "http": ["web-publishing"],
    "https": ["web-publishing"],
    "web-publishing": ["web-publishing"],
    "ai-gateway": ["ai-gateways"],
    "telephony-pbx": ["telephony-pbx"],
    "voice-stack": ["voice-stack"],
    "vordr-stack": ["vordr-stack"],
}
DEFAULT_DISCOVERY_PORTS = [
    {"port": 80, "label": "HTTP", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 443, "label": "HTTPS", "service_type": "https", "plugin_id": None, "scheme": "https"},
    {"port": 3000, "label": "Web UI", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 5432, "label": "PostgreSQL", "service_type": "postgresql", "plugin_id": "postgres", "scheme": None},
    {"port": 6379, "label": "Redis", "service_type": "redis", "plugin_id": "redis", "scheme": None},
    {"port": 27017, "label": "MongoDB", "service_type": "mongodb", "plugin_id": "mongodb", "scheme": None},
    {"port": 9200, "label": "Elasticsearch", "service_type": "elasticsearch", "plugin_id": "elasticsearch", "scheme": "http"},
    {"port": 9090, "label": "Prometheus", "service_type": "prometheus", "plugin_id": "prometheus", "scheme": "http"},
    {"port": 9100, "label": "Node Exporter", "service_type": "prometheus-exporter", "plugin_id": None, "scheme": "http"},
    {"port": 9093, "label": "Alertmanager", "service_type": "prometheus", "plugin_id": "prometheus", "scheme": "http"},
    {"port": 2375, "label": "Docker API", "service_type": "docker-container", "plugin_id": "docker-local", "scheme": "http"},
    {"port": 2376, "label": "Docker API TLS", "service_type": "docker-container", "plugin_id": "docker-local", "scheme": None},
    {"port": 6443, "label": "Kubernetes API", "service_type": "kubernetes", "plugin_id": "kubernetes", "scheme": "https"},
    {"port": 10250, "label": "Kubelet", "service_type": "kubernetes", "plugin_id": "kubernetes", "scheme": "https"},
    {"port": 8000, "label": "API", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 8080, "label": "HTTP Alt", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 8096, "label": "Service", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 8200, "label": "Vault", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 8787, "label": "Web App", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 9123, "label": "TTS", "service_type": "http", "plugin_id": None, "scheme": "http"},
    {"port": 9092, "label": "Kafka", "service_type": "kafka", "plugin_id": "kafka", "scheme": None},
    {"port": 4222, "label": "NATS", "service_type": "nats", "plugin_id": "nats", "scheme": None},
    {"port": 80, "label": "Nginx", "service_type": "http", "plugin_id": "nginx", "scheme": "http", "hint_only": True},
    {"port": 443, "label": "Nginx TLS", "service_type": "https", "plugin_id": "nginx", "scheme": "https", "hint_only": True},
]

PROMETHEUS_FINGERPRINTS = [
    {"match": ["nginx_http_requests_total", "nginx_connections_active"], "plugin_id": "nginx", "service_type": "http", "confidence": 0.9},
    {"match": ["prometheus_engine_queries", "prometheus_tsdb_head_series"], "plugin_id": "prometheus", "service_type": "prometheus", "confidence": 0.95},
    {"match": ["process_open_fds", "go_gc_duration_seconds", "node_cpu_seconds_total"], "plugin_id": None, "service_type": "prometheus-exporter", "confidence": 0.55},
    {"match": ["pg_up", "pg_stat_database_xact_commit"], "plugin_id": "postgres", "service_type": "postgresql", "confidence": 0.95},
    {"match": ["redis_up", "redis_memory_used_bytes"], "plugin_id": "redis", "service_type": "redis", "confidence": 0.95},
    {"match": ["rabbitmq_queue_messages", "rabbitmq_connections"], "plugin_id": "rabbitmq", "service_type": "rabbitmq", "confidence": 0.95},
    {"match": ["mongodb_up", "mongodb_ss_connections"], "plugin_id": "mongodb", "service_type": "mongodb", "confidence": 0.95},
    {"match": ["elasticsearch_cluster_health_status", "elasticsearch_indices_docs"], "plugin_id": "elasticsearch", "service_type": "elasticsearch", "confidence": 0.95},
    {"match": ["kube_node_info", "kube_pod_status_phase"], "plugin_id": "kubernetes", "service_type": "kubernetes", "confidence": 0.95},
    {"match": ["container_cpu_usage_seconds_total", "container_memory_usage_bytes"], "plugin_id": "docker-local", "service_type": "docker-container", "confidence": 0.8},
    {"match": ["kafka_brokertopicmetrics_messagesin_total", "kafka_server_replicamanager_partitioncount"], "plugin_id": "kafka", "service_type": "kafka", "confidence": 0.95},
    {"match": ["gnatsd_varz_in_msgs", "gnatsd_varz_connections"], "plugin_id": "nats", "service_type": "nats", "confidence": 0.95},
]
DEFAULT_ALERT_RULES = [
    {
        "name": "Host CPU above 90%",
        "description": "Trigger when host CPU remains above 90%",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "cpu_percent", "operator": ">", "value": 90, "duration_minutes": 5},
        "target_type": "host",
        "scope": {},
        "cooldown_seconds": 300,
    },
    {
        "name": "Host memory above 85%",
        "description": "Trigger when host memory stays above 85%",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "memory_percent", "operator": ">", "value": 85, "duration_minutes": 5},
        "target_type": "host",
        "scope": {},
        "cooldown_seconds": 300,
    },
    {
        "name": "Host disk above 90%",
        "description": "Trigger when host disk usage exceeds 90%",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "disk_percent", "operator": ">", "value": 90, "duration_minutes": 10},
        "target_type": "host",
        "scope": {},
        "cooldown_seconds": 600,
    },
    {
        "name": "Service latency above 250ms",
        "description": "Trigger when a monitored service gets slow",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "latency_ms", "operator": ">", "value": 250, "duration_minutes": 3},
        "target_type": "service",
        "scope": {},
        "cooldown_seconds": 300,
    },
    {
        "name": "Service uptime below 99.5%",
        "description": "Trigger when service uptime drops below SLO",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "uptime_percent", "operator": "<", "value": 99.5},
        "target_type": "service",
        "scope": {},
        "cooldown_seconds": 900,
    },
    {
        "name": "PostgreSQL latency above 200ms",
        "description": "Trigger when PostgreSQL services are slow",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "latency_ms", "operator": ">", "value": 200, "duration_minutes": 3},
        "target_type": "service",
        "scope": {"plugin_id": "postgres", "service_type": "postgresql"},
        "cooldown_seconds": 300,
    },
    {
        "name": "Redis latency above 75ms",
        "description": "Trigger when Redis services slow down",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "latency_ms", "operator": ">", "value": 75, "duration_minutes": 2},
        "target_type": "service",
        "scope": {"plugin_id": "redis", "service_type": "redis"},
        "cooldown_seconds": 180,
    },
    {
        "name": "RabbitMQ uptime below 99%",
        "description": "Trigger when RabbitMQ availability drops",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "uptime_percent", "operator": "<", "value": 99},
        "target_type": "service",
        "scope": {"plugin_id": "rabbitmq", "service_type": "rabbitmq"},
        "cooldown_seconds": 600,
    },
]


async def _get_stream_user(token: str) -> User:
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


async def _get_user_workspace_id(user_id: UUID, requested_workspace_id: UUID | None = None) -> UUID | None:
    async with async_session() as db:
        query = (
            select(WorkspaceMembership.workspace_id)
            .where(WorkspaceMembership.user_id == user_id)
            .order_by(WorkspaceMembership.created_at.asc())
        )
        if requested_workspace_id:
            query = query.where(WorkspaceMembership.workspace_id == requested_workspace_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()


def _service_status(latency_ms: float) -> str:
    if latency_ms > 500:
        return "critical"
    if latency_ms > 200:
        return "warning"
    return "healthy"


def _classification_for_discovery(plugin_id: str | None, service_type: str | None, source: str) -> dict:
    suggested_profiles = list(PROFILE_HINTS_BY_SERVICE_TYPE.get((service_type or "").lower(), []))
    if plugin_id:
        if plugin_id in {"ai-gateways", "telephony-pbx", "voice-stack", "vordr-stack", "web-publishing"}:
            if plugin_id not in suggested_profiles:
                suggested_profiles.append(plugin_id)
            return {
                "plugin_id": None,
                "suspected_plugin_id": None,
                "classification_state": "generic",
                "classification_confidence": 0.4,
                "classification_source": source,
                "suggested_profile_ids": suggested_profiles,
            }
        return {
            "plugin_id": None,
            "suspected_plugin_id": plugin_id,
            "classification_state": "suspected",
            "classification_confidence": 0.65,
            "classification_source": source,
            "suggested_profile_ids": suggested_profiles,
        }
    return {
        "plugin_id": None,
        "suspected_plugin_id": None,
        "classification_state": "generic",
        "classification_confidence": 0.3,
        "classification_source": source,
        "suggested_profile_ids": suggested_profiles,
    }


def _classification_for_verified(plugin_id: str | None, service_type: str | None, source: str) -> dict:
    suggested_profiles = list(PROFILE_HINTS_BY_SERVICE_TYPE.get((service_type or "").lower(), []))
    if plugin_id in {"ai-gateways", "telephony-pbx", "voice-stack", "vordr-stack", "web-publishing"}:
        if plugin_id and plugin_id not in suggested_profiles:
            suggested_profiles.append(plugin_id)
        return {
            "plugin_id": None,
            "suspected_plugin_id": None,
            "classification_state": "generic",
            "classification_confidence": 0.5,
            "classification_source": source,
            "suggested_profile_ids": suggested_profiles,
        }
    return {
        "plugin_id": plugin_id,
        "suspected_plugin_id": plugin_id,
        "classification_state": "verified" if plugin_id else "generic",
        "classification_confidence": 1.0 if plugin_id else 0.35,
        "classification_source": source,
        "suggested_profile_ids": suggested_profiles,
    }


def _downsample_metric_points(points: list[ServiceMetric], max_points: int = 120) -> list[ServiceMetric]:
    if len(points) <= max_points:
        return points
    stride = max(1, len(points) // max_points)
    sampled = points[::stride]
    if sampled[-1].id != points[-1].id:
        sampled.append(points[-1])
    return sampled[-max_points:]


def _service_to_out(
    service: Service,
    history: list[ServiceMetric] | None = None,
    *,
    host_name: str | None = None,
    host_status: str | None = None,
    host_type: str | None = None,
    host_ip_address: str | None = None,
) -> ServiceWithSparkline:
    if history:
        spark = [round(point.latency_ms or 0, 1) for point in history[-7:]]
    else:
        base_latency = service.latency_ms or 50
        spark = [round(base_latency * (0.9 + 0.2 * (i % 3) / 3), 1) for i in range(7)]
    payload = ServiceOut.model_validate(service).model_dump()
    payload.update({
        "host_name": host_name,
        "host_status": host_status,
        "host_type": host_type,
        "host_ip_address": host_ip_address,
    })
    return ServiceWithSparkline(**payload, spark=spark)


def _bucket_service_metric_points(points: list[ServiceMetric], bucket_seconds: int) -> list[ServiceMetric]:
    if len(points) <= 1 or bucket_seconds <= 1:
        return points

    buckets: dict[int, list[ServiceMetric]] = {}
    for point in points:
        ts = point.recorded_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        bucket_key = int(ts.timestamp()) // bucket_seconds
        buckets.setdefault(bucket_key, []).append(point)

    aggregated: list[ServiceMetric] = []
    for bucket_key in sorted(buckets):
        bucket = buckets[bucket_key]
        sample = bucket[-1]

        def avg(attr: str) -> float:
            values = [float(getattr(item, attr) or 0) for item in bucket]
            return sum(values) / max(len(values), 1)

        aggregated.append(
            ServiceMetric(
                id=sample.id,
                service_id=sample.service_id,
                latency_ms=avg("latency_ms"),
                requests_per_min=avg("requests_per_min"),
                uptime_percent=avg("uptime_percent"),
                recorded_at=sample.recorded_at,
            )
        )
    return aggregated


async def _fetch_service_sparks(db: AsyncSession, workspace_id: UUID, service_ids: list[UUID], limit: int = 7) -> dict[UUID, list[ServiceMetric]]:
    if not service_ids:
        return {}

    ranked = (
        select(
            ServiceMetric.id.label("id"),
            ServiceMetric.service_id.label("service_id"),
            ServiceMetric.latency_ms.label("latency_ms"),
            ServiceMetric.requests_per_min.label("requests_per_min"),
            ServiceMetric.uptime_percent.label("uptime_percent"),
            ServiceMetric.recorded_at.label("recorded_at"),
            func.row_number().over(partition_by=ServiceMetric.service_id, order_by=ServiceMetric.recorded_at.desc()).label("rn"),
        )
        .where(ServiceMetric.workspace_id == workspace_id, ServiceMetric.service_id.in_(service_ids))
        .subquery()
    )

    result = await db.execute(
        select(ranked)
        .where(ranked.c.rn <= limit)
        .order_by(ranked.c.service_id.asc(), ranked.c.rn.desc())
    )

    sparks: dict[UUID, list[ServiceMetric]] = {service_id: [] for service_id in service_ids}
    for row in result.mappings():
        sparks[row["service_id"]].append(
            ServiceMetric(
                id=row["id"],
                service_id=row["service_id"],
                latency_ms=row["latency_ms"],
                requests_per_min=row["requests_per_min"],
                uptime_percent=row["uptime_percent"],
                recorded_at=row["recorded_at"],
            )
        )
    return sparks


async def _query_services(
    db: AsyncSession,
    workspace_id: UUID,
    *,
    search: str | None = None,
    status: str | None = None,
    host_id: UUID | None = None,
    plugin_id: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[ServiceWithSparkline], int]:
    filters = [Service.workspace_id == workspace_id]
    if search:
        term = f"%{search}%"
        filters.append(or_(Service.name.ilike(term), Service.endpoint.ilike(term), Service.url.ilike(term)))
    if status and status != "all":
        filters.append(Service.status == status)
    if host_id:
        filters.append(Service.host_id == host_id)
    if plugin_id and plugin_id != "all":
        filters.append(Service.plugin_id == plugin_id)

    total_result = await db.execute(select(func.count()).select_from(Service).where(*filters))
    total = int(total_result.scalar() or 0)

    result = await db.execute(
        select(Service, Host.name, Host.status, Host.type, Host.ip_address)
        .outerjoin(Host, Host.id == Service.host_id)
        .where(*filters)
        .order_by(Service.name)
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()
    services = [row[0] for row in rows]
    if not services:
        return [], total

    sparks = await _fetch_service_sparks(db, workspace_id, [service.id for service in services])
    row_map = {service.id: row for service, *row in rows}
    return [
        _service_to_out(
            service,
            sparks.get(service.id, []),
            host_name=row_map[service.id][0],
            host_status=row_map[service.id][1],
            host_type=row_map[service.id][2],
            host_ip_address=row_map[service.id][3],
        )
        for service in services
    ], total


def _tcp_open_sync(host: str, port: int, timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


async def _tcp_open(host: str, port: int, timeout: float = 0.35) -> bool:
    return await asyncio.to_thread(_tcp_open_sync, host, port, timeout)


async def _inspect_prometheus_endpoint(url: str, timeout: float = 1.5) -> tuple[bool, dict | None]:
    metrics_url = url.rstrip("/") + "/metrics"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(metrics_url, headers={"Accept": "text/plain"})
            if response.status_code >= 400:
                return False, None
            text = response.text[:20000]
            is_prom = "# HELP" in text or "# TYPE" in text or "_total" in text or "_bucket" in text
            if not is_prom:
                return False, None
            lower_text = text.lower()
            for fingerprint in PROMETHEUS_FINGERPRINTS:
                matches = fingerprint.get("match", [])
                if matches and all(token.lower() in lower_text for token in matches):
                    return True, {
                        "plugin_id": fingerprint.get("plugin_id"),
                        "service_type": fingerprint.get("service_type"),
                        "confidence": fingerprint.get("confidence", 0.8),
                        "source": "prometheus-fingerprint",
                        "matched_metrics": matches,
                    }
            return True, {
                "plugin_id": None,
                "service_type": "prometheus-exporter",
                "confidence": 0.55,
                "source": "prometheus-fingerprint",
                "matched_metrics": [],
            }
    except Exception:
        return False, None


@router.get("", response_model=ServiceListResponse)
async def list_services(
    search: str | None = None,
    status: str | None = None,
    host_id: UUID | None = None,
    plugin_id: str | None = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    items, total = await _query_services(
        db,
        workspace.id,
        search=search,
        status=status,
        host_id=host_id,
        plugin_id=plugin_id,
        limit=limit,
        offset=offset,
    )
    return ServiceListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ServiceOut, status_code=201)
async def create_service(
    req: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    service = Service(workspace_id=workspace.id, **req.model_dump())
    db.add(service)
    await db.flush()
    await db.refresh(service)
    return service


@router.post("/seed-defaults")
async def seed_default_service_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(AlertRule).where(AlertRule.workspace_id == workspace.id))
    existing = result.scalars().all()
    existing_keys = {(rule.name, json.dumps(rule.condition or {}, sort_keys=True)) for rule in existing}

    created = 0
    for rule_data in DEFAULT_ALERT_RULES:
        key = (rule_data["name"], json.dumps(rule_data["condition"], sort_keys=True))
        if key in existing_keys:
            continue
        db.add(AlertRule(workspace_id=workspace.id, **rule_data))
        created += 1

    await db.flush()
    return {"created": created, "total_defaults": len(DEFAULT_ALERT_RULES)}


@router.post("/discover")
async def discover_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    hosts_result = await db.execute(
        select(Host)
        .where(Host.workspace_id == workspace.id, Host.ip_address.is_not(None))
        .order_by(Host.name)
    )
    hosts = [host for host in hosts_result.scalars().all() if host.ip_address and not host.ip_address.startswith("127.")]

    services_result = await db.execute(select(Service).where(Service.workspace_id == workspace.id))
    existing_services = services_result.scalars().all()
    existing_by_key = {
        (str(service.host_id) if service.host_id else "", service.plugin_id or "", service.endpoint or service.url or service.name): service
        for service in existing_services
    }
    stronger_existing_keys = set()
    for service in existing_services:
        metadata = service.plugin_metadata or {}
        if metadata.get("suggested"):
            continue
        endpoint_value = service.endpoint or service.url or ""
        if not endpoint_value or not service.host_id or not service.plugin_id:
            continue
        endpoint_str = str(endpoint_value)
        port = None
        if ":" in endpoint_str:
            candidate = endpoint_str.rsplit(":", 1)[-1].split("/", 1)[0]
            if candidate.isdigit():
                port = candidate
        if port:
            stronger_existing_keys.add((str(service.host_id), service.plugin_id, port))

    discovered = []
    created = 0
    updated = 0
    skipped = 0
    for host in hosts[:25]:
        scan_results = await asyncio.gather(*[_tcp_open(host.ip_address, spec["port"]) for spec in DEFAULT_DISCOVERY_PORTS])
        for spec, is_open in zip(DEFAULT_DISCOVERY_PORTS, scan_results):
            port = spec["port"]
            label = spec["label"]
            service_type = spec["service_type"]
            plugin_id = spec["plugin_id"]
            scheme = spec["scheme"]

            if not is_open:
                continue

            endpoint = f"{host.ip_address}:{port}"
            url = None
            if scheme:
                default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
                url = f"{scheme}://{host.ip_address}" + ("" if default_port else f":{port}")

            stronger_key = (str(host.id), plugin_id, str(port))
            if stronger_key in stronger_existing_keys:
                skipped += 1
                discovered.append({
                    "host": host.name,
                    "host_id": str(host.id),
                    "port": port,
                    "endpoint": endpoint,
                    "url": url,
                    "plugin_id": plugin_id,
                    "service_type": service_type,
                    "prometheus": False,
                    "skipped": True,
                    "reason": "stronger-existing-service",
                })
                continue

            key = (str(host.id), plugin_id, endpoint)
            service = existing_by_key.get(key)
            classification = _classification_for_discovery(plugin_id, service_type, "known-port-scan")
            prometheus = False
            if url:
                prometheus, prom_fingerprint = await _inspect_prometheus_endpoint(url)
                if prometheus and prom_fingerprint:
                    if prom_fingerprint.get("plugin_id"):
                        classification = {
                            **_classification_for_discovery(prom_fingerprint.get("plugin_id"), prom_fingerprint.get("service_type") or service_type, prom_fingerprint.get("source") or "prometheus-fingerprint"),
                            "classification_confidence": prom_fingerprint.get("confidence", 0.8),
                        }
                    else:
                        classification = {
                            **classification,
                            "service_type": prom_fingerprint.get("service_type") or service_type,
                            "classification_confidence": max(classification.get("classification_confidence") or 0, prom_fingerprint.get("confidence", 0.55)),
                            "classification_source": prom_fingerprint.get("source") or "prometheus-fingerprint",
                        }
            if service is None:
                service = Service(
                    workspace_id=workspace.id,
                    host_id=host.id,
                    name=f"{host.name} {label}",
                    status="healthy",
                    url=url,
                    endpoint=endpoint,
                    plugin_id=classification["plugin_id"],
                    suspected_plugin_id=classification["suspected_plugin_id"],
                    classification_state=classification["classification_state"],
                    classification_confidence=classification["classification_confidence"],
                    classification_source=classification["classification_source"],
                    suggested_profile_ids=classification["suggested_profile_ids"],
                    service_type=classification.get("service_type") or service_type,
                    plugin_metadata={"source": classification["classification_source"], "port": port},
                    uptime_percent=100.0,
                    latency_ms=20 + (port % 30),
                    requests_per_min=0,
                    endpoints_count=1,
                    check_interval=60,
                )
                db.add(service)
                await db.flush()
                existing_by_key[key] = service
                created += 1
            else:
                service.host_id = host.id
                service.url = url
                service.endpoint = endpoint
                service.plugin_id = classification["plugin_id"]
                service.suspected_plugin_id = classification["suspected_plugin_id"]
                service.classification_state = classification["classification_state"]
                service.classification_confidence = classification["classification_confidence"]
                service.classification_source = classification["classification_source"]
                service.suggested_profile_ids = classification["suggested_profile_ids"]
                service.service_type = classification.get("service_type") or service_type
                service.plugin_metadata = {**(service.plugin_metadata or {}), "source": classification["classification_source"], "port": port}
                updated += 1

            if url and prometheus:
                existing_monitor = (
                    await db.execute(select(Monitor).where(Monitor.workspace_id == workspace.id, Monitor.type == "prometheus", Monitor.target == f"{url.rstrip('/')}/metrics"))
                ).scalars().first()
                if not existing_monitor:
                    db.add(
                        Monitor(
                            workspace_id=workspace.id,
                            name=f"{service.name} Prometheus",
                            type="prometheus",
                            target=f"{url.rstrip('/')}/metrics",
                            interval_seconds=60,
                            timeout_seconds=15,
                            enabled=True,
                            config={"source": "service-discovery", "linked_service_id": str(service.id)},
                            status="unknown",
                        )
                    )

            discovered.append({
                "host": host.name,
                "host_id": str(host.id),
                "port": port,
                "endpoint": endpoint,
                "url": url,
                "plugin_id": classification["plugin_id"],
                "suspected_plugin_id": classification["suspected_plugin_id"],
                "classification_state": classification["classification_state"],
                "classification_confidence": classification["classification_confidence"],
                "suggested_profile_ids": classification["suggested_profile_ids"],
                "service_type": classification.get("service_type") or service_type,
                "prometheus": prometheus,
            })

    await db.flush()
    return {"created": created, "updated": updated, "skipped": skipped, "discovered": discovered[:100]}


@router.get("/stream")
async def stream_services(
    request: Request,
    token: str = Query(...),
    workspace_id: UUID | None = Query(default=None),
    search: str | None = None,
    status: str | None = None,
    host_id: UUID | None = None,
    plugin_id: str | None = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    stream_user = await _get_stream_user(token)
    workspace_id = await _get_user_workspace_id(stream_user.id, workspace_id)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                if not workspace_id:
                    payload = json.dumps({"services": []}, separators=(",", ":"))
                else:
                    services, _total = await _query_services(
                        db,
                        workspace_id,
                        search=search,
                        status=status,
                        host_id=host_id,
                        plugin_id=plugin_id,
                        limit=limit,
                        offset=offset,
                    )
                    payload = json.dumps({"services": [service.model_dump(mode="json") for service in services]}, separators=(",", ":"))
            if payload != last_payload:
                yield f"data: {payload}\n\n"
                last_payload = payload
            else:
                yield ": keepalive\n\n"
            await asyncio.sleep(STREAM_INTERVAL_SECONDS)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{service_id}", response_model=ServiceOut)
async def get_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Service).where(Service.id == service_id, Service.workspace_id == workspace.id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.get("/{service_id}/history", response_model=list[ServiceMetricPointOut])
async def get_service_history(
    service_id: UUID,
    hours: int = Query(24, ge=1, le=24 * 30),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    service_result = await db.execute(select(Service).where(Service.id == service_id, Service.workspace_id == workspace.id))
    service = service_result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    history_result = await db.execute(
        select(ServiceMetric)
        .where(
            ServiceMetric.workspace_id == workspace.id,
            ServiceMetric.service_id == service.id,
            ServiceMetric.recorded_at >= since,
        )
        .order_by(ServiceMetric.recorded_at.asc())
    )
    raw_points = history_result.scalars().all()
    bucket_seconds = 60 if hours <= 1 else 300 if hours <= 24 else 3600
    points = _bucket_service_metric_points(raw_points, bucket_seconds)
    points = _downsample_metric_points(points, max_points=180)
    return [ServiceMetricPointOut.model_validate(point) for point in points]


@router.put("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: UUID,
    req: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Service).where(Service.id == service_id, Service.workspace_id == workspace.id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(service, k, v)
    if req.latency_ms is not None and req.status is None:
        service.status = _service_status(req.latency_ms)
    if req.latency_ms is not None or req.requests_per_min is not None or req.uptime_percent is not None:
        latest_metrics = await fetch_latest_service_metrics(db, [service.id])
        latest_metric = latest_metrics.get(service.id)
        if should_record_service_metric(service, latest_metric):
            db.add(build_service_metric(service))
    await db.flush()
    await evaluate_service_alert_rules(db, workspace.id, service)
    await db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=204)
async def delete_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Service).where(Service.id == service_id, Service.workspace_id == workspace.id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    await db.delete(service)
    return None
