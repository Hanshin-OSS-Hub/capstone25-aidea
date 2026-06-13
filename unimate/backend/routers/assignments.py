import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.response import success
from models.user import User
from schemas.assignment import AssignmentCreate, AssignmentUpdate
import services.assignment_service as assignment_service

router = APIRouter()


@router.get("")
async def get_assignments(
    status: str | None = Query(None),
    week: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await assignment_service.get_assignments(db, current_user.id, status, week)
    return success(data)


@router.get("/count")
async def get_pending_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await assignment_service.get_pending_count(db, current_user.id)
    return success({"count": count})


@router.post("", status_code=201)
async def create_assignment(
    body: AssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await assignment_service.create_assignment(db, current_user.id, body)
    return success(data)


@router.put("/{assignment_id}")
async def update_assignment(
    assignment_id: uuid.UUID,
    body: AssignmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await assignment_service.update_assignment(db, current_user.id, assignment_id, body)
    return success(data)


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await assignment_service.delete_assignment(db, current_user.id, assignment_id)
    return success({"message": "과제가 삭제됐습니다"})
