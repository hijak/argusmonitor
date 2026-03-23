from datetime import datetime, timedelta, timezone

import asyncio
import json

from fastapi import APIRouter, Depends, Query, Request, status, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import decode_token, get_current_user
from app.database import async_session, get_db
from app.models import AlertInstance, Host, Incident, Transaction, User, Workspace, WorkspaceMembership
from app.schemas import AlertInstanceOut, IncidentOut, OverviewHostSummary, OverviewStats
from fastapi.responses import StreamingResponse
from uuid import UUID
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/overview", tags=["overview"])
STREAM_INTERVAL_SECONDS = 5
LIVE_HOST_WINDOW = timedelta(seconds=120)


def _host_sort_key(host: Host):
    return (
        0 if host.agent_version else 1,
        0 if host.status == "critical" else 1 if host.status == "warning" else 2 if host.status == "healthy" else 3,
        host.name.lower(),
    )


def _is_host_connected(host: Host) -> bool:
    if not host.agent_version or not host.last_seen:
        return False
    last_seen = host.last_seen if host.last_seen.tzinfo else host.last_seen.replace(tzinfo=timezone.utc)
    return last_seen >= datetime.now(timezone.utc) - LIVE_HOST_WINDOW


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


async def _get_user_workspace_id(user_id: UUID) -> UUID | None:
    async with async_session() as db:
        result = await db.execute(
            select(WorkspaceMembership.workspace_id)
            .where(WorkspaceMembership.user_id == user_id)
            .order_by(WorkspaceMembership.created_at.asc())
        )
        return result.scalar_one_or_none()


async def _overview_host_health_payload(db: AsyncSession, workspace_id: UUID) -> list[OverviewHostSummary]:
    result = await db.execute(select(Host).where(Host.workspace_id == workspace_id))
    hosts = sorted(result.scalars().all(), key=_host_sort_key)[:10]
    return [
        OverviewHostSummary(
            id=host.id,
            name=host.name,
            status=host.status,
            cpu_percent=host.cpu_percent,
            memory_percent=host.memory_percent,
            uptime=host.uptime,
            last_seen=host.last_seen,
            is_agent_connected=_is_host_connected(host),
            spark=[host.cpu_percent] * 7,
        )
        for host in hosts
    ]


@router.get("/stats", response_model=OverviewStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    host_count = (await db.execute(select(func.count(Host.id)).where(Host.workspace_id == workspace.id))).scalar() or 0
    alert_count = (await db.execute(
        select(func.count(AlertInstance.id)).where(AlertInstance.workspace_id == workspace.id, AlertInstance.resolved == False)
    )).scalar() or 0

    health_q = await db.execute(select(func.count(Host.id)).where(Host.workspace_id == workspace.id, Host.status == "healthy"))
    healthy = health_q.scalar() or 0
    health_score = round((healthy / max(host_count, 1)) * 100, 1)

    tx_result = await db.execute(select(func.avg(Transaction.success_rate)).where(Transaction.workspace_id == workspace.id))
    tx_success = round(tx_result.scalar() or 100.0, 1)

    live_agent_count = (await db.execute(select(func.count(Host.id)).where(Host.workspace_id == workspace.id, Host.agent_version.isnot(None)))).scalar() or 0

    return OverviewStats(
        monitored_hosts=host_count,
        active_alerts=alert_count,
        health_score=health_score,
        transaction_success=tx_success,
        hosts_change=f"{live_agent_count} live agents · {host_count} total",
        alerts_change=f"{alert_count} active",
        health_change=f"{health_score}% healthy",
        tx_change=f"{tx_success}% success",
    )


@router.get("/host-health", response_model=list[OverviewHostSummary])
async def get_host_health(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    return await _overview_host_health_payload(db, workspace.id)


@router.get("/host-health/stream")
async def stream_host_health(
    request: Request,
    token: str = Query(...),
):
    stream_user = await _get_stream_user(token)
    workspace_id = await _get_user_workspace_id(stream_user.id)

    async def event_stream():
        last_payload = ""
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as db:
                if not workspace_id:
                    payload = json.dumps({"hosts": []}, separators=(",", ":"))
                else:
                    hosts = await _overview_host_health_payload(db, workspace_id)
                    payload = json.dumps({"hosts": [host.model_dump(mode="json") for host in hosts]}, separators=(",", ":"))

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


@router.get("/recent-alerts", response_model=list[AlertInstanceOut])
async def get_recent_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(AlertInstance)
        .where(AlertInstance.workspace_id == workspace.id, AlertInstance.resolved == False)
        .order_by(AlertInstance.created_at.desc())
        .limit(5)
    )
    return result.scalars().all()


@router.get("/recent-incidents", response_model=list[IncidentOut])
async def get_recent_incidents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.events))
        .where(Incident.workspace_id == workspace.id, Incident.status != "resolved")
        .order_by(Incident.started_at.desc())
        .limit(5)
    )
    return result.scalars().all()


@router.get("/transaction-summary")
async def get_transaction_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(select(Transaction).where(Transaction.workspace_id == workspace.id).order_by(Transaction.name).limit(10))
    txs = result.scalars().all()
    return [
        {
            "name": tx.name,
            "success": tx.success_rate,
            "avgTime": f"{tx.avg_duration_ms / 1000:.1f}s" if tx.avg_duration_ms else "0s",
            "status": tx.status,
        }
        for tx in txs
    ]
