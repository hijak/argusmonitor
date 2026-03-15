import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token, get_current_user
from app.database import async_session, get_db
from app.models import Host, HostMetric, User
from app.schemas import HostCreate, HostOut, HostUpdate, HostWithSparkline

router = APIRouter(prefix="/hosts", tags=["hosts"])
LIVE_HOST_WINDOW = timedelta(seconds=120)
STREAM_INTERVAL_SECONDS = 5


def _host_sort_key(host: Host):
    return (
        0 if _is_host_connected(host) else 1,
        0 if host.status == "critical" else 1 if host.status == "warning" else 2 if host.status == "healthy" else 3,
        host.name.lower(),
    )


def _is_host_connected(host: Host) -> bool:
    if not host.agent_version or not host.last_seen:
        return False
    last_seen = host.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - last_seen <= LIVE_HOST_WINDOW


def _host_out(host: Host, spark: list[float]):
    payload = HostOut.model_validate(host).model_dump()
    payload["is_agent_connected"] = _is_host_connected(host)
    payload["data_source"] = "agent" if host.agent_version else "seeded"
    return HostWithSparkline(
        **payload,
        spark=spark if spark else [host.cpu_percent] * 7,
    )


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


async def _fetch_host_sparks(db: AsyncSession, host_ids: list[UUID], limit: int = 7) -> dict[UUID, list[float]]:
    if not host_ids:
        return {}

    ranked = (
        select(
            HostMetric.host_id.label("host_id"),
            HostMetric.cpu_percent.label("cpu_percent"),
            func.row_number()
            .over(partition_by=HostMetric.host_id, order_by=HostMetric.recorded_at.desc())
            .label("rn"),
        )
        .where(HostMetric.host_id.in_(host_ids))
        .subquery()
    )

    result = await db.execute(
        select(ranked.c.host_id, ranked.c.cpu_percent)
        .where(ranked.c.rn <= limit)
        .order_by(ranked.c.host_id, ranked.c.rn.desc())
    )

    sparks: dict[UUID, list[float]] = {host_id: [] for host_id in host_ids}
    for host_id, cpu_percent in result.all():
        if cpu_percent is not None:
            sparks.setdefault(host_id, []).append(float(cpu_percent))
    return sparks


async def _query_hosts_payload(
    db: AsyncSession,
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[HostWithSparkline]:
    q = select(Host).order_by(Host.name)
    if type:
        q = q.where(Host.type == type)
    if status:
        q = q.where(Host.status == status)
    if search:
        term = f"%{search}%"
        q = q.where(or_(Host.name.ilike(term), Host.ip_address.ilike(term)))

    result = await db.execute(q)
    hosts = sorted(result.scalars().all(), key=_host_sort_key)
    sparks = await _fetch_host_sparks(db, [h.id for h in hosts])
    return [_host_out(host, sparks.get(host.id, [])) for host in hosts]


def _serialize_host_metrics(host: Host, metrics: list[HostMetric]) -> dict:
    cpu_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.cpu_percent, 1)} for m in metrics if m.cpu_percent is not None]
    mem_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.memory_percent, 1)} for m in metrics if m.memory_percent is not None]
    disk_data = [{"time": m.recorded_at.strftime("%H:%M:%S"), "value": round(m.disk_percent, 1)} for m in metrics if m.disk_percent is not None]

    return {
        "host": {
            "id": str(host.id),
            "name": host.name,
            "type": host.type,
            "status": host.status,
            "ip_address": host.ip_address,
            "os": host.os,
            "uptime": host.uptime,
            "cpu_percent": host.cpu_percent,
            "memory_percent": host.memory_percent,
            "disk_percent": host.disk_percent,
            "tags": host.tags or [],
            "agent_version": host.agent_version,
            "last_seen": host.last_seen.isoformat() if host.last_seen else None,
            "is_agent_connected": _is_host_connected(host),
            "data_source": "agent" if host.agent_version else "seeded",
        },
        "cpu": cpu_data,
        "memory": mem_data,
        "disk": disk_data,
    }


@router.get("", response_model=list[HostWithSparkline])
async def list_hosts(
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _query_hosts_payload(db, type=type, status=status, search=search)


@router.post("", response_model=HostOut, status_code=201)
async def create_host(
    req: HostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    host = Host(**req.model_dump())
    db.add(host)
    await db.flush()
    await db.refresh(host)
    return host


@router.get("/stream")
async def stream_hosts(
    request: Request,
    token: str = Query(...),
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
):
    await _get_stream_user(token)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                hosts = await _query_hosts_payload(db, type=type, status=status, search=search)
                payload = json.dumps({"hosts": [h.model_dump(mode="json") for h in hosts]}, separators=(",", ":"))

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


@router.get("/{host_id}", response_model=HostOut)
async def get_host(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    return host


@router.put("/{host_id}", response_model=HostOut)
async def update_host(
    host_id: UUID,
    req: HostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(host, k, v)
    await db.flush()
    await db.refresh(host)
    return host


@router.get("/{host_id}/metrics")
async def get_host_metrics(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    metrics_q = (
        select(HostMetric)
        .where(HostMetric.host_id == host_id)
        .order_by(HostMetric.recorded_at.desc())
        .limit(48)
    )
    metrics_result = await db.execute(metrics_q)
    metrics = list(reversed(metrics_result.scalars().all()))
    return _serialize_host_metrics(host, metrics)


@router.get("/{host_id}/stream")
async def stream_host_metrics(
    host_id: UUID,
    request: Request,
    token: str = Query(...),
):
    await _get_stream_user(token)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                result = await db.execute(select(Host).where(Host.id == host_id))
                host = result.scalar_one_or_none()
                if not host:
                    yield f"data: {json.dumps({'error': 'Host not found'})}\n\n"
                    break

                metrics_result = await db.execute(
                    select(HostMetric)
                    .where(HostMetric.host_id == host_id)
                    .order_by(HostMetric.recorded_at.desc())
                    .limit(48)
                )
                metrics = list(reversed(metrics_result.scalars().all()))
                payload = json.dumps(_serialize_host_metrics(host, metrics), separators=(",", ":"))

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


@router.delete("/{host_id}", status_code=204)
async def delete_host(
    host_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    await db.delete(host)
