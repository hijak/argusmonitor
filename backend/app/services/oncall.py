from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OnCallShift, User


async def get_active_oncall_user(db: AsyncSession) -> User | None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(User)
        .join(OnCallShift, OnCallShift.user_id == User.id)
        .where(OnCallShift.start_at <= now, OnCallShift.end_at > now)
        .order_by(OnCallShift.escalation_level.asc(), OnCallShift.start_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_active_oncall_user_for_team(db: AsyncSession, team_id: UUID | None) -> User | None:
    if not team_id:
        return await get_active_oncall_user(db)

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(User)
        .join(OnCallShift, OnCallShift.user_id == User.id)
        .where(
            OnCallShift.team_id == team_id,
            OnCallShift.start_at <= now,
            OnCallShift.end_at > now,
        )
        .order_by(OnCallShift.escalation_level.asc(), OnCallShift.start_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()
