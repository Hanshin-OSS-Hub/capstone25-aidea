import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.assignment import UserInterestTag
from schemas.user import UserMe, UserUpdateRequest, NotificationSettingsRequest
from core.cache import cache_get, cache_set, cache_delete

TAGS_CACHE_TTL = 600  # 10분

def _tags_key(user_id: uuid.UUID) -> str:
    return f"user:tags:{user_id}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_me(db: AsyncSession, user_id: uuid.UUID) -> UserMe:
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다"},
        )
    return UserMe(
        id=str(user.id),
        username=user.username,
        name=user.name,
        department=user.department,
        grade=user.grade,
        email=user.email,
        fcm_token=user.fcm_token,
    )


async def update_me(
    db: AsyncSession, user_id: uuid.UUID, request: UserUpdateRequest
) -> UserMe:
    values = request.model_dump(exclude_unset=True)
    if not values:
        return await get_me(db, user_id)

    await db.execute(
        update(User).where(User.id == user_id).values(**values)
    )
    await db.commit()

    from core.dependencies import invalidate_user_cache
    await invalidate_user_cache(user_id)

    return await get_me(db, user_id)


async def update_notification_settings(
    db: AsyncSession, user_id: uuid.UUID, request: NotificationSettingsRequest
) -> dict:
    settings_dict = request.model_dump()
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(notification_settings=settings_dict)
    )
    await db.commit()
    return settings_dict


async def get_interest_tags(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    cached = await cache_get(_tags_key(user_id))
    if cached is not None:
        return cached

    result = await db.execute(
        select(UserInterestTag.tag).where(UserInterestTag.user_id == user_id)
    )
    tags = [row[0] for row in result.all()]
    await cache_set(_tags_key(user_id), tags, ttl=TAGS_CACHE_TTL)
    return tags


async def update_interest_tags(
    db: AsyncSession, user_id: uuid.UUID, tags: list[str]
) -> list[str]:
    await db.execute(
        delete(UserInterestTag).where(UserInterestTag.user_id == user_id)
    )
    for tag in tags:
        db.add(UserInterestTag(user_id=user_id, tag=tag))
    await db.commit()
    await cache_delete(_tags_key(user_id))
    return tags


async def delete_me(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(deleted_at=_now())
    )
    await db.commit()
