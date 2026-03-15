from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AlertRule, AlertInstance, User
from app.schemas import AlertRuleCreate, AlertRuleOut, AlertInstanceOut
from app.auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/rules", response_model=list[AlertRuleOut])
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_rule(
    req: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rule = AlertRule(**req.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.get("", response_model=list[AlertInstanceOut])
async def list_alerts(
    severity: str | None = None,
    acknowledged: bool | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(AlertInstance).order_by(AlertInstance.created_at.desc()).limit(limit)
    if severity:
        q = q.where(AlertInstance.severity == severity)
    if acknowledged is not None:
        q = q.where(AlertInstance.acknowledged == acknowledged)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{alert_id}/acknowledge", response_model=AlertInstanceOut)
async def acknowledge_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = user.name
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(alert)
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertInstanceOut)
async def resolve_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(AlertInstance).where(AlertInstance.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(alert)
    return alert
