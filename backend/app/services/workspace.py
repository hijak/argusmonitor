from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Workspace, WorkspaceMembership


async def get_current_workspace(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_workspace_id: str | None = Header(default=None, alias="X-Workspace-Id"),
) -> Workspace:
    membership_query = select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id)

    if x_workspace_id:
        membership_query = membership_query.where(WorkspaceMembership.workspace_id == x_workspace_id)

    membership_result = await db.execute(membership_query.order_by(WorkspaceMembership.created_at.asc()))
    membership = membership_result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No accessible workspace found for current user",
        )

    workspace = await db.get(Workspace, membership.workspace_id)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


async def get_workspace_membership(db: AsyncSession, workspace_id, user_id):
    result = await db.execute(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()
