from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import LogEntry, User
from app.schemas import LogEntryCreate, LogEntryOut
from app.auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[LogEntryOut])
async def list_logs(
    level: str | None = None,
    service: str | None = None,
    search: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(LogEntry).order_by(LogEntry.timestamp.desc()).limit(limit)
    if level:
        q = q.where(LogEntry.level == level)
    if service:
        q = q.where(LogEntry.service == service)
    if search:
        q = q.where(LogEntry.message.ilike(f"%{search}%"))
    result = await db.execute(q)
    entries = result.scalars().all()
    return [
        LogEntryOut(
            id=e.id, timestamp=e.timestamp, level=e.level,
            service=e.service, message=e.message, metadata=e.extra_data or {}
        )
        for e in entries
    ]


@router.post("/ingest", response_model=LogEntryOut, status_code=201)
async def ingest_log(
    req: LogEntryCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = LogEntry(
        level=req.level,
        service=req.service,
        message=req.message,
        extra_data=req.metadata,
    )
    if req.timestamp:
        entry.timestamp = req.timestamp
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return LogEntryOut(
        id=entry.id, timestamp=entry.timestamp, level=entry.level,
        service=entry.service, message=entry.message, metadata=entry.extra_data or {}
    )


@router.post("/ingest/batch", status_code=201)
async def ingest_logs_batch(
    entries: list[LogEntryCreate],
    db: AsyncSession = Depends(get_db),
):
    for req in entries:
        entry = LogEntry(
            level=req.level,
            service=req.service,
            message=req.message,
            extra_data=req.metadata,
        )
        if req.timestamp:
            entry.timestamp = req.timestamp
        db.add(entry)
    await db.flush()
    return {"ingested": len(entries)}
