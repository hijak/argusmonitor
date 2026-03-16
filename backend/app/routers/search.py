from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Host, Service, Dashboard, Transaction, AlertRule, User, Workspace
from app.auth import get_current_user
from app.services.workspace import get_current_workspace

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    term = f"%{q}%"
    results = []

    hosts = (await db.execute(
        select(Host.id, Host.name, Host.ip_address, Host.type, Host.status)
        .where(Host.workspace_id == workspace.id, or_(Host.name.ilike(term), Host.ip_address.ilike(term)))
        .limit(8)
    )).all()
    for h in hosts:
        results.append({
            "type": "host",
            "id": str(h.id),
            "title": h.name,
            "subtitle": h.ip_address or h.type,
            "status": h.status,
            "url": "/infrastructure",
        })

    services = (await db.execute(
        select(Service.id, Service.name, Service.url, Service.status)
        .where(Service.workspace_id == workspace.id, or_(Service.name.ilike(term), Service.url.ilike(term)))
        .limit(5)
    )).all()
    for s in services:
        results.append({
            "type": "service",
            "id": str(s.id),
            "title": s.name,
            "subtitle": s.url or "",
            "status": s.status,
            "url": "/services",
        })

    dashboards = (await db.execute(
        select(Dashboard.id, Dashboard.name, Dashboard.type)
        .where(Dashboard.workspace_id == workspace.id, Dashboard.name.ilike(term))
        .limit(5)
    )).all()
    for d in dashboards:
        results.append({
            "type": "dashboard",
            "id": str(d.id),
            "title": d.name,
            "subtitle": d.type,
            "url": f"/dashboards/{d.id}",
        })

    transactions = (await db.execute(
        select(Transaction.id, Transaction.name, Transaction.status)
        .where(Transaction.workspace_id == workspace.id, Transaction.name.ilike(term))
        .limit(5)
    )).all()
    for t in transactions:
        results.append({
            "type": "transaction",
            "id": str(t.id),
            "title": t.name,
            "subtitle": "transaction",
            "status": t.status,
            "url": "/transactions",
        })

    return results
