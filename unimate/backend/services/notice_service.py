import uuid
import logging
import traceback
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, delete, func, and_, case, exists
from sqlalchemy.ext.asyncio import AsyncSession

from models.notice import Notice, UserNoticeBookmark

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_notices(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    try:
        bookmark_subq = (
            select(UserNoticeBookmark.notice_id)
            .where(UserNoticeBookmark.user_id == user_id)
            .correlate(Notice)
            .scalar_subquery()
        )
        is_bookmarked_expr = case(
            (Notice.id.in_(
                select(UserNoticeBookmark.notice_id).where(UserNoticeBookmark.user_id == user_id)
            ), True),
            else_=False,
        ).label("is_bookmarked")

        query = select(Notice, is_bookmarked_expr)
        count_query = select(func.count(Notice.id))

        if category and category != "all":
            query = query.where(Notice.category == category)
            count_query = count_query.where(Notice.category == category)

        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        query = (
            query
            .order_by(Notice.published_at.desc().nullslast())
            .offset((page - 1) * limit)
            .limit(limit)
        )

        result = await db.execute(query)
        rows = result.all()

        items = [
            {
                "id": str(notice.id),
                "title": notice.title,
                "category": notice.category,
                "published_at": notice.published_at.isoformat() if notice.published_at else None,
                "source_type": notice.source_type,
                "is_bookmarked": is_bm,
            }
            for notice, is_bm in rows
        ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": (page * limit) < total,
        }
    except Exception as e:
        logger.error(f"get_notices 오류: {e}")
        traceback.print_exc()
        raise


async def get_notice(
    db: AsyncSession, user_id: uuid.UUID, notice_id: uuid.UUID
) -> dict:
    result = await db.execute(
        select(Notice).where(Notice.id == notice_id)
    )
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOTICE_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
        )

    bm_result = await db.execute(
        select(UserNoticeBookmark).where(
            UserNoticeBookmark.user_id == user_id,
            UserNoticeBookmark.notice_id == notice_id,
        )
    )
    is_bookmarked = bm_result.scalar_one_or_none() is not None

    return {
        "id": str(notice.id),
        "title": notice.title,
        "category": notice.category,
        "published_at": notice.published_at.isoformat() if notice.published_at else None,
        "source_type": notice.source_type,
        "is_bookmarked": is_bookmarked,
        "content": notice.content,
        "summary": notice.summary,
        "source_url": notice.source_url,
    }


async def toggle_bookmark(
    db: AsyncSession, user_id: uuid.UUID, notice_id: uuid.UUID
) -> bool:
    """북마크 토글. 추가하면 True, 삭제하면 False 반환."""
    notice_result = await db.execute(
        select(Notice.id).where(Notice.id == notice_id)
    )
    if not notice_result.scalar_one_or_none():
        raise HTTPException(
            status_code=404,
            detail={"code": "NOTICE_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
        )

    result = await db.execute(
        select(UserNoticeBookmark).where(
            UserNoticeBookmark.user_id == user_id,
            UserNoticeBookmark.notice_id == notice_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.execute(
            delete(UserNoticeBookmark).where(UserNoticeBookmark.id == existing.id)
        )
        await db.commit()
        return False
    else:
        db.add(UserNoticeBookmark(user_id=user_id, notice_id=notice_id))
        await db.commit()
        return True


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """최근 24시간 내 공지 중 북마크 안 한 것 count."""
    since = _now() - timedelta(hours=24)

    bookmarked_ids = (
        select(UserNoticeBookmark.notice_id)
        .where(UserNoticeBookmark.user_id == user_id)
    )

    result = await db.execute(
        select(func.count(Notice.id)).where(
            Notice.crawled_at >= since,
            Notice.id.notin_(bookmarked_ids),
        )
    )
    return result.scalar() or 0


async def get_summary(db: AsyncSession, notice_id: uuid.UUID) -> str | None:
    result = await db.execute(
        select(Notice.summary).where(Notice.id == notice_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        notice_check = await db.execute(
            select(Notice.id).where(Notice.id == notice_id)
        )
        if not notice_check.scalar_one_or_none():
            raise HTTPException(
                status_code=404,
                detail={"code": "NOTICE_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
            )
    return row
