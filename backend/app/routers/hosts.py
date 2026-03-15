from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Host, HostMetric, User
from app.schemas import HostCreate, HostUpdate, HostOut, HostWithSparkline
from app.auth import get_current_user

router = APIRouter(prefix="/hosts", tags=["hosts"])


@router.get("", response_model=list[HostWithSparkline])
async def list_hosts(
    type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Host).order_by(Host.name)
    if type:
        q = q.where(Host.type == type)
    if status:
        q = q.where(Host.status == status)
    if search:
        q = q.where(Host.name.ilike(f"%{search}%") | Host.ip_address.ilike(f"%{search}%"))

    result = await db.execute(q)
    hosts = result.scalars().all()

    out = []
    for h in hosts:
        metrics_q = (
            select(HostMetric.cpu_percent)
            .where(HostMetric.host_id == h.id)
            .order_by(HostMetric.recorded_at.desc())
            .limit(7)
        )
        metrics_result = await db.execute(metrics_q)
        spark = [float(m) for m in metrics_result.scalars().all() if m is not None]
        spark.reverse()
        out.append(HostWithSparkline(
            **HostOut.model_validate(h).model_dump(),
            spark=spark if spark else [h.cpu_percent] * 7,
        ))
    return out


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
