from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AIChatMessage, TransactionRun, User
from app.schemas import AIChatRequest, AIChatResponse, AIGenerateTransactionRequest, AIExplainFailureRequest
from app.auth import get_current_user
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=AIChatResponse)
async def chat(
    req: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user_msg = AIChatMessage(
        user_id=user.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.flush()

    ai = AIService()
    history_result = await db.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.created_at.desc())
        .limit(20)
    )
    history = list(reversed(history_result.scalars().all()))

    messages = [{"role": m.role, "content": m.content} for m in history]
    response_text = await ai.chat(messages)

    assistant_msg = AIChatMessage(
        user_id=user.id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_msg)
    await db.flush()

    return AIChatResponse(
        role="assistant",
        content=response_text,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/history", response_model=list[AIChatResponse])
async def get_history(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == user.id)
        .order_by(AIChatMessage.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [
        AIChatResponse(role=m.role, content=m.content, timestamp=m.created_at)
        for m in messages
    ]


@router.post("/generate-transaction")
async def generate_transaction(
    req: AIGenerateTransactionRequest,
    user: User = Depends(get_current_user),
):
    ai = AIService()
    result = await ai.generate_transaction(req.prompt)
    return result


@router.post("/explain-failure")
async def explain_failure(
    req: AIExplainFailureRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TransactionRun)
        .options(selectinload(TransactionRun.step_results))
        .where(TransactionRun.id == req.run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    ai = AIService()
    explanation = await ai.explain_failure(run)
    return {"explanation": explanation}
