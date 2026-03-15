from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dashboard, User
from app.schemas import DashboardCreate, DashboardOut
from app.auth import get_current_user

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("", response_model=list[DashboardOut])
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).order_by(Dashboard.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=DashboardOut, status_code=201)
async def create_dashboard(
    req: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = Dashboard(**req.model_dump())
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.delete(dashboard)
