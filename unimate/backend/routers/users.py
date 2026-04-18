from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success
from models.user import User
from schemas.user import UserUpdateRequest, NotificationSettingsRequest
import services.user_service as user_service

router = APIRouter()


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await user_service.get_me(db, current_user.id)
    return success(data.model_dump())


@router.put("/me")
async def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await user_service.update_me(db, current_user.id, body)
    return success(data.model_dump())


@router.put("/me/notification-settings")
async def update_notification_settings(
    body: NotificationSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await user_service.update_notification_settings(db, current_user.id, body)
    return success(data)


@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await user_service.delete_me(db, current_user.id)
    return success({"message": "탈퇴가 완료됐습니다"})
