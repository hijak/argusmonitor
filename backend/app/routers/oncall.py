from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import OnCallShift, OnCallTeam, User
from app.schemas import OnCallShiftCreate, OnCallShiftOut, OnCallTeamCreate, OnCallTeamOut

router = APIRouter(prefix="/oncall", tags=["oncall"])


async def _ensure_oncall_schema(db: AsyncSession) -> None:
    def sync_ensure(sync_session):
        connection = sync_session.connection()
        inspector = inspect(connection)
        tables = inspector.get_table_names()

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

        if "oncall_shifts" not in tables:
            connection.execute(text("""
                CREATE TABLE oncall_shifts (
                    id UUID PRIMARY KEY,
                    team_id UUID NOT NULL REFERENCES oncall_teams(id) ON DELETE CASCADE,
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
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_start_at ON oncall_shifts(start_at)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_oncall_shifts_end_at ON oncall_shifts(end_at)"))

    await db.run_sync(sync_ensure)


async def _seed_defaults(db: AsyncSession) -> None:
    result = await db.execute(select(OnCallTeam))
    teams = result.scalars().all()
    if teams:
        return

    team = OnCallTeam(name="Primary Ops", timezone="Europe/London", description="Default on-call rotation")
    db.add(team)
    await db.flush()

    year = datetime.now(timezone.utc).year
    month = datetime.now(timezone.utc).month
    shifts = [
        OnCallShift(team_id=team.id, person_name="Jack", email="jack@example.com", start_at=datetime(year, month, 1, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 8, 0, 0, tzinfo=timezone.utc), escalation_level=1, notes="Primary"),
        OnCallShift(team_id=team.id, person_name="Plutus", email="plutus@example.com", start_at=datetime(year, month, 8, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 15, 0, 0, tzinfo=timezone.utc), escalation_level=1, notes="Bot-assisted coverage"),
        OnCallShift(team_id=team.id, person_name="Backup Ops", email="backup@example.com", start_at=datetime(year, month, 15, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 22, 0, 0, tzinfo=timezone.utc), escalation_level=2, notes="Escalation"),
        OnCallShift(team_id=team.id, person_name="Jack", email="jack@example.com", start_at=datetime(year, month, 22, 0, 0, tzinfo=timezone.utc), end_at=datetime(year, month, 29, 0, 0, tzinfo=timezone.utc), escalation_level=1, notes="Primary"),
    ]
    db.add_all(shifts)
    await db.flush()


@router.get("/teams", response_model=list[OnCallTeamOut])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _ensure_oncall_schema(db)
    await _seed_defaults(db)
    result = await db.execute(select(OnCallTeam).order_by(OnCallTeam.name))
    return result.scalars().all()


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
    await db.refresh(team)
    return team


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
    return result.scalars().all()


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

    shift = OnCallShift(**req.model_dump())
    db.add(shift)
    await db.flush()
    await db.refresh(shift)
    return shift
