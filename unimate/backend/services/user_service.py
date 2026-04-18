import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from schemas.user import UserMe, UserUpdateRequest, NotificationSettingsRequest


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


async def delete_me(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(User).where(User.id == user_id).values(deleted_at=_now())
    )
    await db.commit()
