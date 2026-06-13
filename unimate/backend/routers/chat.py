import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success

router = APIRouter()


class ChatMessageRequest(BaseModel):
    session_id: Optional[uuid.UUID] = None
    message: str


@router.post("/message")
async def send_message(
    body: ChatMessageRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from services.chat_service import run_agent

    return StreamingResponse(
        run_agent(db, user.id, body.session_id, body.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/daily-summary")
async def daily_summary(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from services.chat_service import get_daily_summary

    result = await get_daily_summary(db, user.id)
    return success({"summary": result})
