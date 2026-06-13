import uuid
import logging
import traceback

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success
from models.user import User
import services.notice_service as notice_service

logger = logging.getLogger(__name__)
logger.info("notices 라우터 로드됨")

router = APIRouter()


@router.get("")
async def get_notices(
    category: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await notice_service.get_notices(db, current_user.id, category, page, limit)
        return success(data)
    except Exception as e:
        logger.error(f"get_notices 오류: {e}")
        traceback.print_exc()
        raise



@router.get("/daily-top3")
async def get_daily_top3(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await notice_service.get_top3_daily(db)
    return success(data)


@router.get("/weekly-top3")
async def get_weekly_top3(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await notice_service.get_top3_weekly(db)
    return success(data)


@router.get("/bookmarks")
async def get_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await notice_service.get_bookmarks(db, current_user.id)
    return success({"items": data})


@router.get("/{notice_id}")
async def get_notice(
    notice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await notice_service.get_notice(db, current_user.id, notice_id)
    return success(data)


@router.get("/{notice_id}/summary")
async def get_summary(
    notice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await notice_service.get_summary(db, notice_id)
    return success({"summary": summary})


@router.post("/{notice_id}/bookmark")
async def toggle_bookmark(
    notice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    is_bookmarked = await notice_service.toggle_bookmark(db, current_user.id, notice_id)
    return success({"is_bookmarked": is_bookmarked})
