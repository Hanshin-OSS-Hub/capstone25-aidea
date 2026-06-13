import uuid
import logging
import traceback
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, delete, func, and_, case, exists
from sqlalchemy.ext.asyncio import AsyncSession

from models.notice import Notice, UserNoticeBookmark
from core.cache import cache_get, cache_set, cache_delete_pattern, cache_delete

logger = logging.getLogger(__name__)

NOTICE_LIST_TTL = 1800  # 30분


def _notice_list_key(user_id: uuid.UUID, page: int, category: str | None) -> str:
    return f"notices:list:{user_id}:{category or 'all'}:{page}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_notices(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    cached = await cache_get(_notice_list_key(user_id, page, category))
    if cached is not None:
        return cached

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

        data = {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": (page * limit) < total,
        }
        await cache_set(_notice_list_key(user_id, page, category), data, ttl=NOTICE_LIST_TTL)
        return data
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


async def get_bookmarks(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """내가 북마크한 공지 목록 반환."""
    result = await db.execute(
        select(Notice)
        .join(UserNoticeBookmark, UserNoticeBookmark.notice_id == Notice.id)
        .where(UserNoticeBookmark.user_id == user_id)
        .order_by(UserNoticeBookmark.created_at.desc())
    )
    notices = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "title": n.title,
            "category": n.category,
            "published_at": n.published_at.isoformat() if n.published_at else None,
            "source_type": n.source_type,
            "is_bookmarked": True,
        }
        for n in notices
    ]


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
        await cache_delete_pattern(f"notices:list:{user_id}:*")
        return False
    else:
        db.add(UserNoticeBookmark(user_id=user_id, notice_id=notice_id))
        await db.commit()
        await cache_delete_pattern(f"notices:list:{user_id}:*")
        return True




CATEGORY_DISPLAY: dict[str, str] = {
    "notice":      "공지사항",
    "academic":    "학사",
    "scholarship": "장학",
    "employment":  "취업",
    "event":       "행사",
    "privacy":     "개인정보",
}


async def _get_top3(db: AsyncSession, date_from: datetime, date_to: datetime) -> list[dict]:
    """날짜 범위 내 최신 공지 3개. 결과 없으면 전체 최신 3개로 폴백."""
    result = await db.execute(
        select(Notice)
        .where(Notice.published_at >= date_from, Notice.published_at <= date_to)
        .order_by(Notice.published_at.desc().nullslast())
        .limit(3)
    )
    notices = result.scalars().all()

    if not notices:
        result = await db.execute(
            select(Notice).order_by(Notice.published_at.desc().nullslast()).limit(3)
        )
        notices = result.scalars().all()

    return [
        {
            "rank": idx + 1,
            "id": str(n.id),
            "title": n.title,
            "category": CATEGORY_DISPLAY.get(n.category or "", n.category or "공지"),
            "published_at": n.published_at.strftime("%Y-%m-%d") if n.published_at else "",
        }
        for idx, n in enumerate(notices)
    ]


async def get_top3_daily(db: AsyncSession) -> list[dict]:
    """일간 추천 공지: 최근 2일 이내."""
    now = _now()
    return await _get_top3(db, date_from=now - timedelta(days=2), date_to=now)


async def get_top3_weekly(db: AsyncSession) -> list[dict]:
    """주간 추천 공지: 최근 8일 이내."""
    now = _now()
    return await _get_top3(db, date_from=now - timedelta(days=8), date_to=now)


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
