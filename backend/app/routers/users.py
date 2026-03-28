from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.models import User
from app.schemas import UserCreateRequest, UserOut, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).order_by(User.name.asc(), User.email.asc()))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    req: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name,
        mobile_number=req.mobile_number,
        role=req.role,
        timezone=req.timezone,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    req: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = req.model_dump(exclude_unset=True)

    if "email" in data:
        existing = await db.execute(select(User).where(User.email == data["email"], User.id != user_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

    for key, value in data.items():
        setattr(user, key, value)

    await db.flush()
    await db.refresh(user)
    return user
