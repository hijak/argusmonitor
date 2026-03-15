from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Host, AlertInstance, Transaction, Service, Incident, User
from app.schemas import OverviewStats, HostWithSparkline, AlertInstanceOut, IncidentOut, HostOut
from app.auth import get_current_user
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/stats", response_model=OverviewStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    host_count = (await db.execute(select(func.count(Host.id)))).scalar() or 0
    alert_count = (await db.execute(
        select(func.count(AlertInstance.id)).where(AlertInstance.resolved == False)
    )).scalar() or 0

    health_q = await db.execute(select(func.count(Host.id)).where(Host.status == "healthy"))
    healthy = health_q.scalar() or 0
    health_score = round((healthy / max(host_count, 1)) * 100, 1)

    tx_result = await db.execute(select(func.avg(Transaction.success_rate)))
    tx_success = round(tx_result.scalar() or 100.0, 1)

    return OverviewStats(
        monitored_hosts=host_count,
        active_alerts=alert_count,
        health_score=health_score,
        transaction_success=tx_success,
        hosts_change=f"+{host_count} total",
        alerts_change=f"{alert_count} active",
        health_change=f"{health_score}%",
        tx_change=f"{tx_success}%",
    )


@router.get("/host-health", response_model=list[HostWithSparkline])
async def get_host_health(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).order_by(Host.name).limit(10))
    hosts = result.scalars().all()
    out = []
    for h in hosts:
        spark = [h.cpu_percent] * 7
        out.append(HostWithSparkline(
            **HostOut.model_validate(h).model_dump(),
            spark=spark,
        ))
    return out


@router.get("/recent-alerts", response_model=list[AlertInstanceOut])
async def get_recent_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AlertInstance)
        .where(AlertInstance.resolved == False)
        .order_by(AlertInstance.created_at.desc())
        .limit(5)
    )
    return result.scalars().all()


@router.get("/recent-incidents", response_model=list[IncidentOut])
async def get_recent_incidents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.events))
        .where(Incident.status != "resolved")
        .order_by(Incident.started_at.desc())
        .limit(5)
    )
    return result.scalars().all()


@router.get("/transaction-summary")
async def get_transaction_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Transaction).order_by(Transaction.name).limit(10))
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
