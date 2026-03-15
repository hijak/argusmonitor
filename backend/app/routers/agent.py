from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Host, HostMetric
from app.schemas import AgentHeartbeatRequest, AgentHeartbeatResponse

router = APIRouter(prefix="/agent", tags=["agent"])


def require_agent_token(x_agent_token: str = Header(default="")) -> None:
    settings = get_settings()
    if not settings.agent_shared_token or x_agent_token != settings.agent_shared_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent token",
        )


def derive_host_status(cpu_percent: float, memory_percent: float, disk_percent: float) -> str:
    if max(cpu_percent, memory_percent, disk_percent) >= 90:
        return "critical"
    if max(cpu_percent, memory_percent, disk_percent) >= 75:
        return "warning"
    return "healthy"


@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
async def heartbeat(
    req: AgentHeartbeatRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_agent_token),
):
    result = await db.execute(select(Host).where(Host.name == req.name))
    host = result.scalar_one_or_none()
    status_value = derive_host_status(req.cpu_percent, req.memory_percent, req.disk_percent)
    now = datetime.now(timezone.utc)

    if host is None:
        host = Host(
            name=req.name,
            type=req.type,
            ip_address=req.ip_address,
            os=req.os,
            tags=req.tags,
        )
        db.add(host)
        await db.flush()

    host.type = req.type
    host.ip_address = req.ip_address
    host.os = req.os
    host.tags = req.tags
    host.cpu_percent = req.cpu_percent
    host.memory_percent = req.memory_percent
    host.disk_percent = req.disk_percent
    host.uptime = req.uptime
    host.agent_version = req.agent_version
    host.status = status_value
    host.last_seen = now

    metric = HostMetric(
        host_id=host.id,
        cpu_percent=req.cpu_percent,
        memory_percent=req.memory_percent,
        disk_percent=req.disk_percent,
        network_in_bytes=req.network_in_bytes,
        network_out_bytes=req.network_out_bytes,
        recorded_at=now,
    )
    db.add(metric)
    await db.flush()

    return AgentHeartbeatResponse(
        host_id=host.id,
        status=host.status,
        recorded_at=now,
    )
