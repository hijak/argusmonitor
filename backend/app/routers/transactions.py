from uuid import UUID
from datetime import datetime, timezone
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Transaction, TransactionStep, TransactionRun, TransactionRunStep, User
from app.schemas import (
    TransactionCreate, TransactionUpdate, TransactionOut,
    TransactionRunOut, TransactionStepOut,
)
from app.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .order_by(Transaction.name)
    )
    return result.scalars().all()


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx = Transaction(
        name=req.name,
        description=req.description,
        schedule=req.schedule,
        interval_seconds=req.interval_seconds,
        environment_vars=req.environment_vars,
    )
    db.add(tx)
    await db.flush()

    for step_data in req.steps:
        step = TransactionStep(
            transaction_id=tx.id,
            order=step_data.order,
            type=step_data.type,
            label=step_data.label,
            config=step_data.config,
        )
        db.add(step)

    await db.flush()
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx.id)
    )
    return result.scalar_one()


@router.get("/{tx_id}", response_model=TransactionOut)
async def get_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.steps))
        .where(Transaction.id == tx_id)
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
):
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.steps)).where(Transaction.id == tx_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(tx, k, v)
    await db.flush()
    await db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)


@router.post("/{tx_id}/run", response_model=TransactionRunOut, status_code=201)
async def run_transaction(
    tx_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).options(selectinload(Transaction.steps)).where(Transaction.id == tx_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    run = TransactionRun(transaction_id=tx.id, status="running")
    db.add(run)
    await db.flush()

    total_ms = 0.0
    all_success = True
    for step in tx.steps:
        step_duration = round(random.uniform(50, 500), 1)
        step_success = random.random() > 0.05
        total_ms += step_duration

        run_step = TransactionRunStep(
            run_id=run.id,
            step_id=step.id,
            order=step.order,
            type=step.type,
            label=step.label,
            status="success" if step_success else "failed",
            duration_ms=step_duration,
            detail=step.config.get("url") or step.config.get("selector") or step.config.get("value", ""),
            error_message=None if step_success else "Simulated step failure",
            executed_at=datetime.now(timezone.utc),
        )
        db.add(run_step)

        if not step_success:
            all_success = False
            break

    run.status = "success" if all_success else "failed"
    run.duration_ms = round(total_ms, 1)
    run.completed_at = datetime.now(timezone.utc)
    if not all_success:
        run.error_message = "One or more steps failed"

    await db.flush()

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
):
    result = await db.execute(
        select(TransactionRun)
        .options(selectinload(TransactionRun.step_results))
        .where(TransactionRun.transaction_id == tx_id)
        .order_by(TransactionRun.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
