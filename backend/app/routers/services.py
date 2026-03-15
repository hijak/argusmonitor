from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Service, User
from app.schemas import ServiceCreate, ServiceUpdate, ServiceOut, ServiceWithSparkline
from app.auth import get_current_user

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ServiceWithSparkline])
async def list_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Service).order_by(Service.name))
    services = result.scalars().all()
    out = []
    for s in services:
        base_latency = s.latency_ms or 50
        spark = [
            round(base_latency * (0.9 + 0.2 * (i % 3) / 3), 1)
            for i in range(7)
        ]
        out.append(ServiceWithSparkline(
            **ServiceOut.model_validate(s).model_dump(),
            spark=spark,
        ))
    return out


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
