from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Transaction,
    TransactionStep,
    TransactionRun,
    User,
    Workspace,
)
from app.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionOut,
    TransactionRunOut,
)
from app.auth import get_current_user
from app.services.workspace import get_current_workspace
from app.services.checks import execute_transaction_run

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.workspace_id == workspace.id)
        .order_by(Transaction.name)
    )
    return result.scalars().all()


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    tx = Transaction(
        workspace_id=workspace.id,
        name=req.name,
        description=req.description,
        schedule=req.schedule,
        cron_expression=req.cron_expression,
        interval_seconds=req.interval_seconds,
        enabled=req.enabled,
        environment_vars=req.environment_vars,
    )
    db.add(tx)
    await db.flush()

    for step_data in req.steps:
        db.add(
            TransactionStep(
                transaction_id=tx.id,
                order=step_data.order,
                type=step_data.type,
                label=step_data.label,
                config=step_data.config,
            )
        )

    await db.flush()
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx.id, Transaction.workspace_id == workspace.id)
    )
    return result.scalar_one()


@router.get("/{tx_id}", response_model=TransactionOut)
async def get_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx_id, Transaction.workspace_id == workspace.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.put("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: UUID,
    req: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx_id, Transaction.workspace_id == workspace.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    payload = req.model_dump(exclude_unset=True, exclude={"steps"})
    steps = req.steps
    for k, v in payload.items():
        setattr(tx, k, v)

    if steps is not None:
        await db.execute(delete(TransactionStep).where(TransactionStep.transaction_id == tx.id))
        await db.flush()
        for step_data in steps:
            db.add(
                TransactionStep(
                    transaction_id=tx.id,
                    order=step_data.order,
                    type=step_data.type,
                    label=step_data.label,
                    config=step_data.config,
                )
            )

    await db.flush()
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx.id, Transaction.workspace_id == workspace.id)
    )
    return result.scalar_one()


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == tx_id, Transaction.workspace_id == workspace.id
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)
    await db.flush()
    return Response(status_code=204)


@router.post("/{tx_id}/run", response_model=TransactionRunOut, status_code=201)
async def run_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx_id, Transaction.workspace_id == workspace.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    run = await execute_transaction_run(db, tx)

    result = await db.execute(
        select(TransactionRun)
        .options(selectinload(TransactionRun.step_results))
        .where(TransactionRun.id == run.id)
    )
    return result.scalar_one()


@router.get("/{tx_id}/runs", response_model=list[TransactionRunOut])
async def list_runs(
    tx_id: UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
):
    tx = (
        await db.execute(
            select(Transaction).where(
                Transaction.id == tx_id, Transaction.workspace_id == workspace.id
            )
        )
    ).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    result = await db.execute(
        select(TransactionRun)
        .options(selectinload(TransactionRun.step_results))
        .where(TransactionRun.transaction_id == tx_id)
        .order_by(TransactionRun.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
