from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success
from models.user import User
from schemas.user import UserUpdateRequest, NotificationSettingsRequest
import services.user_service as user_service


class InterestTagsRequest(BaseModel):
    tags: List[str]

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


@router.get("/me/interest-tags")
async def get_interest_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tags = await user_service.get_interest_tags(db, current_user.id)
    return success({"tags": tags})


@router.put("/me/interest-tags")
async def update_interest_tags(
    body: InterestTagsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tags = await user_service.update_interest_tags(db, current_user.id, body.tags)
    return success({"tags": tags})


@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await user_service.delete_me(db, current_user.id)
    return success({"message": "탈퇴가 완료됐습니다"})
