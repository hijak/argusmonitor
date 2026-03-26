from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import OnCallShift, OnCallTeam, OnCallTeamMember, User
from app.schemas import (
    OnCallShiftCreate,
    OnCallShiftOut,
    OnCallShiftUpdate,
    OnCallTeamCreate,
    OnCallTeamMemberCreate,
    OnCallTeamMemberOut,
    OnCallTeamMemberUpdate,
    OnCallTeamOut,
    OnCallTeamUpdate,
)

router = APIRouter(prefix="/oncall", tags=["oncall"])


async def _ensure_oncall_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()

        if "users" in tables:
            user_columns = {c["name"] for c in inspector.get_columns("users")}
            if "timezone" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(100) NOT NULL DEFAULT 'UTC'"))
            if "is_active" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true"))

        if "oncall_teams" not in tables:
            connection.execute(text("""
                CREATE TABLE oncall_teams (
                    id UUID PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
                    description TEXT,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_teams_name ON oncall_teams(name)"))

        if "oncall_team_members" not in tables:
            connection.execute(text("""
                CREATE TABLE oncall_team_members (
                    id UUID PRIMARY KEY,
                    team_id UUID NOT NULL REFERENCES oncall_teams(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(50) NOT NULL DEFAULT 'member',
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_team_members_team_id ON oncall_team_members(team_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_team_members_user_id ON oncall_team_members(user_id)"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_oncall_team_members_team_user ON oncall_team_members(team_id, user_id)"))

        if "oncall_shifts" not in tables:
            connection.execute(text("""
                CREATE TABLE oncall_shifts (
                    id UUID PRIMARY KEY,
                    team_id UUID NOT NULL REFERENCES oncall_teams(id) ON DELETE CASCADE,
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    person_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    start_at TIMESTAMPTZ NOT NULL,
                    end_at TIMESTAMPTZ NOT NULL,
                    escalation_level INTEGER NOT NULL DEFAULT 1,
                    notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_team_id ON oncall_shifts(team_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_user_id ON oncall_shifts(user_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_start_at ON oncall_shifts(start_at)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_end_at ON oncall_shifts(end_at)"))
        else:
            shift_columns = {c["name"] for c in inspector.get_columns("oncall_shifts")}
            if "user_id" not in shift_columns:
                connection.execute(text("ALTER TABLE oncall_shifts ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_user_id ON oncall_shifts(user_id)"))

    await db.run_sync(sync_ensure)


async def _seed_defaults(db: AsyncSession) -> None:
    result = await db.execute(select(OnCallTeam))
    teams = result.scalars().all()
    if teams:
        return

    admin_result = await db.execute(select(User).order_by(User.created_at.asc()))
    admin = admin_result.scalars().first()
    if not admin:
        return

    team = OnCallTeam(name="Primary Ops", timezone=admin.timezone or "Europe/London", description="Default on-call rotation")
    db.add(team)
    await db.flush()

    db.add(OnCallTeamMember(team_id=team.id, user_id=admin.id, role="lead"))

    year = datetime.now(timezone.utc).year
    month = datetime.now(timezone.utc).month
    db.add_all([
        OnCallShift(team_id=team.id, user_id=admin.id, person_name=admin.name, email=admin.email, start_at=datetime(year, month, 1, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 8, 0, 0, tzinfo=timezone.utc), escalation_level=1, notes="Primary"),
        OnCallShift(team_id=team.id, user_id=admin.id, person_name=admin.name, email=admin.email, start_at=datetime(year, month, 22, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 29, 0, 0, tzinfo=timezone.utc), escalation_level=1, notes="Primary"),
    ])
    await db.flush()


@router.get("/teams", response_model=list[OnCallTeamOut])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    await _seed_defaults(db)

    teams_result = await db.execute(select(OnCallTeam).order_by(OnCallTeam.name.asc()))
    teams = teams_result.scalars().all()

    members_result = await db.execute(select(OnCallTeamMember).order_by(OnCallTeamMember.created_at.asc()))
    members = members_result.scalars().all()

    user_ids = sorted({member.user_id for member in members})
    users_by_id: dict[UUID, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

    members_by_team: dict[UUID, list[OnCallTeamMemberOut]] = {}
    for member in members:
        members_by_team.setdefault(member.team_id, []).append(
            OnCallTeamMemberOut(
                id=member.id,
                team_id=member.team_id,
                user_id=member.user_id,
                role=member.role,
                created_at=member.created_at,
                updated_at=member.updated_at,
                user=users_by_id.get(member.user_id),
            )
        )

    return [
        OnCallTeamOut(
            id=team.id,
            name=team.name,
            timezone=team.timezone,
            description=team.description,
            created_at=team.created_at,
            updated_at=team.updated_at,
            members=members_by_team.get(team.id, []),
        )
        for team in teams
    ]


@router.post("/teams", response_model=OnCallTeamOut, status_code=201)
async def create_team(
    req: OnCallTeamCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    team = OnCallTeam(**req.model_dump())
    db.add(team)
    await db.flush()

    lead_member = OnCallTeamMember(team_id=team.id, user_id=user.id, role="lead")
    db.add(lead_member)
    await db.flush()
    await db.refresh(team)

    return OnCallTeamOut(
        id=team.id,
        name=team.name,
        timezone=team.timezone,
        description=team.description,
        created_at=team.created_at,
        updated_at=team.updated_at,
        members=[
            OnCallTeamMemberOut(
                id=lead_member.id,
                team_id=lead_member.team_id,
                user_id=lead_member.user_id,
                role=lead_member.role,
                created_at=lead_member.created_at,
                updated_at=lead_member.updated_at,
                user=user,
            )
        ],
    )


@router.put("/teams/{team_id}", response_model=OnCallTeamOut)
async def update_team(
    team_id: UUID,
    req: OnCallTeamUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    team_result = await db.execute(select(OnCallTeam).where(OnCallTeam.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="On-call team not found")

    team.name = req.name
    team.timezone = req.timezone
    team.description = req.description
    await db.flush()
    await db.refresh(team)

    members_result = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.team_id == team_id).order_by(OnCallTeamMember.created_at.asc()))
    members = members_result.scalars().all()
    user_ids = sorted({member.user_id for member in members})
    users_by_id: dict[UUID, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

    return OnCallTeamOut(
        id=team.id,
        name=team.name,
        timezone=team.timezone,
        description=team.description,
        created_at=team.created_at,
        updated_at=team.updated_at,
        members=[
            OnCallTeamMemberOut(
                id=member.id,
                team_id=member.team_id,
                user_id=member.user_id,
                role=member.role,
                created_at=member.created_at,
                updated_at=member.updated_at,
                user=users_by_id.get(member.user_id),
            )
            for member in members
        ],
    )


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(
    team_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    team_result = await db.execute(select(OnCallTeam).where(OnCallTeam.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="On-call team not found")
    await db.delete(team)
    await db.flush()


@router.post("/teams/{team_id}/members", response_model=OnCallTeamMemberOut, status_code=201)
async def add_team_member(
    team_id: UUID,
    req: OnCallTeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)

    team_result = await db.execute(select(OnCallTeam).where(OnCallTeam.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="On-call team not found")

    user_result = await db.execute(select(User).where(User.id == req.user_id))
    member_user = user_result.scalar_one_or_none()
    if not member_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.team_id == team_id, OnCallTeamMember.user_id == req.user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    member = OnCallTeamMember(team_id=team_id, user_id=req.user_id, role=req.role)
    db.add(member)
    await db.flush()
    await db.refresh(member)

    return OnCallTeamMemberOut(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user=member_user,
    )


@router.put("/teams/{team_id}/members/{member_id}", response_model=OnCallTeamMemberOut)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    req: OnCallTeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    result = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.id == member_id, OnCallTeamMember.team_id == team_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="On-call team member not found")

    member.role = req.role
    await db.flush()
    await db.refresh(member)

    user_result = await db.execute(select(User).where(User.id == member.user_id))
    member_user = user_result.scalar_one_or_none()
    return OnCallTeamMemberOut(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user=member_user,
    )


@router.delete("/teams/{team_id}/members/{member_id}", status_code=204)
async def delete_team_member(
    team_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    result = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.id == member_id, OnCallTeamMember.team_id == team_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="On-call team member not found")
    await db.delete(member)
    await db.flush()


@router.get("/shifts", response_model=list[OnCallShiftOut])
async def list_shifts(
    team_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    await _seed_defaults(db)
    q = select(OnCallShift).order_by(OnCallShift.start_at.asc())
    if team_id:
        q = q.where(OnCallShift.team_id == team_id)
    result = await db.execute(q)
    shifts = result.scalars().all()

    user_ids = sorted({shift.user_id for shift in shifts if shift.user_id})
    users_by_id: dict[UUID, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

    return [
        OnCallShiftOut(
            id=shift.id,
            team_id=shift.team_id,
            user_id=shift.user_id,
            person_name=shift.person_name,
            email=shift.email,
            start_at=shift.start_at,
            end_at=shift.end_at,
            escalation_level=shift.escalation_level,
            notes=shift.notes,
            created_at=shift.created_at,
            updated_at=shift.updated_at,
            user=users_by_id.get(shift.user_id) if shift.user_id else None,
        )
        for shift in shifts
    ]


@router.post("/shifts", response_model=OnCallShiftOut, status_code=201)
async def create_shift(
    req: OnCallShiftCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    if req.end_at <= req.start_at:
        raise HTTPException(status_code=400, detail="Shift end must be after start")

    team_result = await db.execute(select(OnCallTeam).where(OnCallTeam.id == req.team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="On-call team not found")

    assigned_user = None
    if req.user_id:
        user_result = await db.execute(select(User).where(User.id == req.user_id))
        assigned_user = user_result.scalar_one_or_none()
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")

        member_result = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.team_id == req.team_id, OnCallTeamMember.user_id == req.user_id))
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Assigned user is not a member of this on-call team")

    person_name = req.person_name or (assigned_user.name if assigned_user else None)
    email = req.email or (assigned_user.email if assigned_user else None)
    if not person_name:
        raise HTTPException(status_code=400, detail="person_name is required when no user is assigned")

    shift = OnCallShift(
        team_id=req.team_id,
        user_id=req.user_id,
        person_name=person_name,
        email=email,
        start_at=req.start_at,
        end_at=req.end_at,
        escalation_level=req.escalation_level,
        notes=req.notes,
    )
    db.add(shift)
    await db.flush()
    await db.refresh(shift)

    return OnCallShiftOut(
        id=shift.id,
        team_id=shift.team_id,
        user_id=shift.user_id,
        person_name=shift.person_name,
        email=shift.email,
        start_at=shift.start_at,
        end_at=shift.end_at,
        escalation_level=shift.escalation_level,
        notes=shift.notes,
        created_at=shift.created_at,
        updated_at=shift.updated_at,
        user=assigned_user,
    )


@router.put("/shifts/{shift_id}", response_model=OnCallShiftOut)
async def update_shift(
    shift_id: UUID,
    req: OnCallShiftUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    if req.end_at <= req.start_at:
        raise HTTPException(status_code=400, detail="Shift end must be after start")

    shift_result = await db.execute(select(OnCallShift).where(OnCallShift.id == shift_id))
    shift = shift_result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="On-call shift not found")

    assigned_user = None
    if req.user_id:
        user_result = await db.execute(select(User).where(User.id == req.user_id))
        assigned_user = user_result.scalar_one_or_none()
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")

        member_result = await db.execute(select(OnCallTeamMember).where(OnCallTeamMember.team_id == shift.team_id, OnCallTeamMember.user_id == req.user_id))
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Assigned user is not a member of this on-call team")

    person_name = req.person_name or (assigned_user.name if assigned_user else shift.person_name)
    email = req.email if req.email is not None else (assigned_user.email if assigned_user else shift.email)
    if not person_name:
        raise HTTPException(status_code=400, detail="person_name is required when no user is assigned")

    shift.user_id = req.user_id
    shift.person_name = person_name
    shift.email = email
    shift.start_at = req.start_at
    shift.end_at = req.end_at
    shift.escalation_level = req.escalation_level
    shift.notes = req.notes
    await db.flush()
    await db.refresh(shift)

    return OnCallShiftOut(
        id=shift.id,
        team_id=shift.team_id,
        user_id=shift.user_id,
        person_name=shift.person_name,
        email=shift.email,
        start_at=shift.start_at,
        end_at=shift.end_at,
        escalation_level=shift.escalation_level,
        notes=shift.notes,
        created_at=shift.created_at,
        updated_at=shift.updated_at,
        user=assigned_user,
    )


@router.delete("/shifts/{shift_id}", status_code=204)
async def delete_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    shift_result = await db.execute(select(OnCallShift).where(OnCallShift.id == shift_id))
    shift = shift_result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="On-call shift not found")
    await db.delete(shift)
    await db.flush()
