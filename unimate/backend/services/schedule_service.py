import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import select, update, delete, extract, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.schedule import UserSchedule
from schemas.schedule import ScheduleCreate, ScheduleUpdate
from core.cache import cache_get, cache_set, cache_delete

# 한국 표준시 (UTC+9)
KST = timezone(timedelta(hours=9))

SCHEDULE_COUNT_TTL = 300    # 5분
SCHEDULE_EXAM_TTL  = 3600   # 1시간


def _count_key(user_id: uuid.UUID, category: str) -> str:
    return f"schedule:count:{user_id}:{category}"


def _exam_key(user_id: uuid.UUID) -> str:
    return f"schedule:next-exam:{user_id}"


async def _invalidate_schedule_cache(user_id: uuid.UUID) -> None:
    """일정 변경 시 count/next-exam 캐시 삭제"""
    await cache_delete(
        _count_key(user_id, "과제"),
        _count_key(user_id, "시험"),
        _exam_key(user_id),
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today_kst() -> str:
    """오늘 날짜를 KST 기준 YYYY-MM-DD 문자열로 반환."""
    return datetime.now(KST).strftime("%Y-%m-%d")


async def _invalidate_briefing_cache(user_id: uuid.UUID) -> None:
    """일정 변경 시 AI 브리핑 캐시 삭제."""
    cache_key = f"summary:{user_id}:{_today_kst()}"
    try:
        from core.redis import get_redis_pool
        redis = get_redis_pool()
        await redis.delete(cache_key)
    except Exception:
        pass


def _to_response(s: UserSchedule) -> dict:
    # KST 기준으로 날짜/시간 추출 (UTC 저장 시 하루 밀리는 문제 방지)
    local_dt = s.start_at.astimezone(KST)
    date_str = local_dt.strftime("%Y-%m-%d")
    time_str = local_dt.strftime("%H:%M") if not s.is_allday else None
    return {
        "id": str(s.id),
        "title": s.title,
        "date": date_str,
        "time": time_str,
        "category": s.category or "개인",
        "memo": s.description,
        "has_alarm": bool(s.alert_days),
        "type": s.source,
        "is_completed": bool(s.is_completed),
    }


async def get_schedules(
    db: AsyncSession,
    user_id: uuid.UUID,
    month: str | None = None,
) -> list[dict]:
    query = select(UserSchedule).where(UserSchedule.user_id == user_id)

    if month:
        try:
            year, mon = month.split("-")
            year, mon = int(year), int(mon)
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=422,
                detail={"code": "VALIDATION_ERROR", "message": "month는 YYYY-MM 형식이어야 합니다"},
            )
        query = query.where(
            extract("year", UserSchedule.start_at) == year,
            extract("month", UserSchedule.start_at) == mon,
        )

    query = query.order_by(UserSchedule.start_at.asc())
    result = await db.execute(query)
    return [_to_response(s) for s in result.scalars().all()]


async def create_schedule(
    db: AsyncSession, user_id: uuid.UUID, request: ScheduleCreate
) -> dict:
    schedule = UserSchedule(
        user_id=user_id,
        title=request.title,
        description=request.description,
        category=request.category,
        source="user",
        start_at=request.start_at,
        end_at=request.end_at,
        is_allday=request.is_allday,
        alert_days=request.alert_days,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    await _invalidate_briefing_cache(user_id)
    await _invalidate_schedule_cache(user_id)
    return _to_response(schedule)


async def _get_own(
    db: AsyncSession, user_id: uuid.UUID, schedule_id: uuid.UUID
) -> UserSchedule:
    result = await db.execute(
        select(UserSchedule).where(
            UserSchedule.id == schedule_id,
            UserSchedule.user_id == user_id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(
            status_code=404,
            detail={"code": "SCHEDULE_NOT_FOUND", "message": "일정을 찾을 수 없습니다"},
        )
    return schedule


async def update_schedule(
    db: AsyncSession,
    user_id: uuid.UUID,
    schedule_id: uuid.UUID,
    request: ScheduleUpdate,
) -> dict:
    schedule = await _get_own(db, user_id, schedule_id)

    if schedule.source == "system":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "학사 일정은 수정할 수 없습니다"},
        )

    values = request.model_dump(exclude_unset=True)
    if values:
        await db.execute(
            update(UserSchedule)
            .where(UserSchedule.id == schedule_id)
            .values(**values)
        )
        await db.commit()

    await db.refresh(schedule)
    await _invalidate_briefing_cache(user_id)
    await _invalidate_schedule_cache(user_id)
    return _to_response(schedule)


async def delete_schedule(
    db: AsyncSession, user_id: uuid.UUID, schedule_id: uuid.UUID
) -> None:
    schedule = await _get_own(db, user_id, schedule_id)

    if schedule.source == "system":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "학사 일정은 삭제할 수 없습니다"},
        )

    await db.execute(
        delete(UserSchedule).where(UserSchedule.id == schedule_id)
    )
    await db.commit()
    await _invalidate_briefing_cache(user_id)
    await _invalidate_schedule_cache(user_id)


async def get_category_count(
    db: AsyncSession, user_id: uuid.UUID, category: str
) -> int:
    """특정 카테고리의 미래 미완료 일정 개수 반환."""
    cached = await cache_get(_count_key(user_id, category))
    if cached is not None:
        return cached

    now = _now()
    result = await db.execute(
        select(func.count(UserSchedule.id)).where(
            UserSchedule.user_id == user_id,
            UserSchedule.category == category,
            UserSchedule.start_at >= now,
            UserSchedule.is_completed == False,  # noqa: E712
        )
    )
    count = result.scalar() or 0
    await cache_set(_count_key(user_id, category), count, ttl=SCHEDULE_COUNT_TTL)
    return count


async def get_upcoming_by_category(
    db: AsyncSession, user_id: uuid.UUID, category: str, limit: int = 20
) -> list[dict]:
    """특정 카테고리의 미래 미완료 일정 목록 반환."""
    now = _now()
    result = await db.execute(
        select(UserSchedule)
        .where(
            UserSchedule.user_id == user_id,
            UserSchedule.category == category,
            UserSchedule.start_at >= now,
            UserSchedule.is_completed == False,  # noqa: E712
        )
        .order_by(UserSchedule.start_at.asc())
        .limit(limit)
    )
    return [_to_response(s) for s in result.scalars().all()]


async def get_next_exam(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    cached = await cache_get(_exam_key(user_id))
    if cached is not None:
        return cached if cached != "__none__" else None

    now = _now()
    result = await db.execute(
        select(UserSchedule)
        .where(
            UserSchedule.user_id == user_id,
            UserSchedule.category == "시험",
            UserSchedule.start_at >= now,
        )
        .order_by(UserSchedule.start_at.asc())
        .limit(1)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        # None도 캐시 (불필요한 반복 쿼리 방지)
        await cache_set(_exam_key(user_id), "__none__", ttl=SCHEDULE_EXAM_TTL)
        return None

    today_kst = datetime.now(KST).date()
    exam_date_kst = exam.start_at.astimezone(KST).date()
    dday = (exam_date_kst - today_kst).days
    data = {
        "title": exam.title,
        "start_at": exam.start_at.isoformat(),
        "dday": dday,
    }
    await cache_set(_exam_key(user_id), data, ttl=SCHEDULE_EXAM_TTL)
    return data
