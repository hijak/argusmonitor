from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Monitor, MonitorResult, User
from app.schemas import MonitorCreate, MonitorUpdate, MonitorOut, MonitorResultOut
from app.auth import get_current_user

router = APIRouter(prefix="/monitors", tags=["monitors"])


@router.get("", response_model=list[MonitorOut])
async def list_monitors(
    type: str | None = None,
    enabled: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Monitor).order_by(Monitor.name)
    if type:
        q = q.where(Monitor.type == type)
    if enabled is not None:
        q = q.where(Monitor.enabled == enabled)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=MonitorOut, status_code=201)
async def create_monitor(
    req: MonitorCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    monitor = Monitor(**req.model_dump())
    db.add(monitor)
    await db.flush()
    await db.refresh(monitor)
    return monitor


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(
    monitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return monitor


@router.put("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: UUID,
    req: MonitorUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(monitor, k, v)
    await db.flush()
    await db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    await db.delete(monitor)


@router.get("/{monitor_id}/results", response_model=list[MonitorResultOut])
async def get_monitor_results(
    monitor_id: UUID,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MonitorResult)
        .where(MonitorResult.monitor_id == monitor_id)
        .order_by(MonitorResult.checked_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
