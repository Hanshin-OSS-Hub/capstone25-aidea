import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success
from models.user import User
from schemas.schedule import ScheduleCreate, ScheduleUpdate
import services.schedule_service as schedule_service

router = APIRouter()


@router.get("")
async def get_schedules(
    month: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await schedule_service.get_schedules(db, current_user.id, month)
    return success(data)


@router.get("/count")
async def get_category_count(
    category: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await schedule_service.get_category_count(db, current_user.id, category)
    return success({"count": count})


@router.get("/upcoming")
async def get_upcoming_by_category(
    category: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await schedule_service.get_upcoming_by_category(db, current_user.id, category)
    return success(data)


@router.get("/next-exam")
async def get_next_exam(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await schedule_service.get_next_exam(db, current_user.id)
    return success(data)


@router.post("", status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await schedule_service.create_schedule(db, current_user.id, body)
    return success(data)


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: uuid.UUID,
    body: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await schedule_service.update_schedule(db, current_user.id, schedule_id, body)
    return success(data)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await schedule_service.delete_schedule(db, current_user.id, schedule_id)
    return success({"message": "일정이 삭제됐습니다"})
