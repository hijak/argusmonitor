import asyncio
import json
import socket
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Host, Service, User
from app.schemas import ServiceCreate, ServiceOut, ServiceUpdate, ServiceWithSparkline

router = APIRouter(prefix="/services", tags=["services"])
STREAM_INTERVAL_SECONDS = 5
DEFAULT_DISCOVERY_PORTS = [
    (80, "HTTP"),
    (443, "HTTPS"),
    (3000, "Web UI"),
    (5432, "PostgreSQL"),
    (6379, "Redis"),
    (8000, "API"),
    (8080, "HTTP Alt"),
    (8096, "Service"),
    (8200, "Vault"),
    (8787, "Web App"),
    (9123, "TTS"),
]
DEFAULT_ALERT_RULES = [
    {
        "name": "Host CPU above 90%",
        "description": "Trigger when host CPU remains above 90%",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "cpu_percent", "operator": ">", "value": 90, "duration_minutes": 5},
        "target_type": "host",
        "cooldown_seconds": 300,
    },
    {
        "name": "Host memory above 85%",
        "description": "Trigger when host memory stays above 85%",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "memory_percent", "operator": ">", "value": 85, "duration_minutes": 5},
        "target_type": "host",
        "cooldown_seconds": 300,
    },
    {
        "name": "Host disk above 90%",
        "description": "Trigger when host disk usage exceeds 90%",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "disk_percent", "operator": ">", "value": 90, "duration_minutes": 10},
        "target_type": "host",
        "cooldown_seconds": 600,
    },
    {
        "name": "Service latency above 250ms",
        "description": "Trigger when a monitored service gets slow",
        "severity": "warning",
        "type": "threshold",
        "condition": {"metric": "latency_ms", "operator": ">", "value": 250, "duration_minutes": 3},
        "target_type": "service",
        "cooldown_seconds": 300,
    },
    {
        "name": "Service uptime below 99.5%",
        "description": "Trigger when service uptime drops below SLO",
        "severity": "critical",
        "type": "threshold",
        "condition": {"metric": "uptime_percent", "operator": "<", "value": 99.5},
        "target_type": "service",
        "cooldown_seconds": 900,
    },
]


def _service_status(latency_ms: float) -> str:
    if latency_ms > 500:
        return "critical"
    if latency_ms > 200:
        return "warning"
    return "healthy"


def _service_to_out(service: Service) -> ServiceWithSparkline:
    base_latency = service.latency_ms or 50
    spark = [round(base_latency * (0.9 + 0.2 * (i % 3) / 3), 1) for i in range(7)]
    return ServiceWithSparkline(**ServiceOut.model_validate(service).model_dump(), spark=spark)


async def _query_services(db: AsyncSession) -> list[ServiceWithSparkline]:
    result = await db.execute(select(Service).order_by(Service.name))
    return [_service_to_out(service) for service in result.scalars().all()]


async def _tcp_open(host: str, port: int, timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@router.get("", response_model=list[ServiceWithSparkline])
async def list_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _query_services(db)


@router.post("", response_model=ServiceOut, status_code=201)
async def create_service(
    req: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = Service(**req.model_dump())
    db.add(service)
    await db.flush()
    await db.refresh(service)
    return service


@router.post("/seed-defaults")
async def seed_default_service_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models import AlertRule

    result = await db.execute(select(AlertRule))
    existing = result.scalars().all()
    existing_keys = {(rule.name, json.dumps(rule.condition or {}, sort_keys=True)) for rule in existing}

    created = 0
    for rule_data in DEFAULT_ALERT_RULES:
        key = (rule_data["name"], json.dumps(rule_data["condition"], sort_keys=True))
        if key in existing_keys:
            continue
        db.add(AlertRule(**rule_data))
        created += 1

    await db.flush()
    return {"created": created, "total_defaults": len(DEFAULT_ALERT_RULES)}


@router.post("/discover")
async def discover_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hosts_result = await db.execute(select(Host).where(Host.ip_address.is_not(None)).order_by(Host.name))
    hosts = [host for host in hosts_result.scalars().all() if host.ip_address and not host.ip_address.startswith("127.")]

    services_result = await db.execute(select(Service))
    existing_services = services_result.scalars().all()
    existing_urls = {service.url for service in existing_services if service.url}

    discovered = []
    created = 0
    for host in hosts[:25]:
        for port, label in DEFAULT_DISCOVERY_PORTS:
            is_open = await _tcp_open(host.ip_address, port)
            if not is_open:
                continue

            scheme = "https" if port == 443 else "http"
            default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
            url = f"{scheme}://{host.ip_address}" + ("" if default_port else f":{port}")
            if url in existing_urls:
                continue

            service = Service(
                name=f"{host.name} {label}",
                status="healthy",
                url=url,
                uptime_percent=100.0,
                latency_ms=20 + (port % 30),
                requests_per_min=0,
                endpoints_count=1,
                check_interval=60,
            )
            db.add(service)
            existing_urls.add(url)
            created += 1
            discovered.append({"host": host.name, "port": port, "url": url})

    await db.flush()
    return {"created": created, "discovered": discovered[:50]}


@router.get("/stream")
async def stream_services(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            services = await _query_services(db)
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
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@router.put("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: UUID,
    req: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(service, k, v)
    if req.latency_ms is not None and req.status is None:
        service.status = _service_status(req.latency_ms)
    await db.flush()
    await db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=204)
async def delete_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    await db.delete(service)
