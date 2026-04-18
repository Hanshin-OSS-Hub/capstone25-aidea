import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.assignment import Assignment
from schemas.assignment import AssignmentCreate, AssignmentUpdate


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_response(a: Assignment) -> dict:
    return {
        "id": str(a.id),
        "title": a.title,
        "description": a.description,
        "subject": a.subject,
        "due_date": a.due_date.isoformat() if a.due_date else None,
        "is_completed": a.is_completed,
        "created_at": a.created_at.isoformat(),
    }


async def get_assignments(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: str | None = None,
    week: str | None = None,
) -> list[dict]:
    query = select(Assignment).where(Assignment.user_id == user_id)

    if status == "pending":
        query = query.where(Assignment.is_completed == False)
    elif status == "completed":
        query = query.where(Assignment.is_completed == True)

    if week == "current":
        now = _now()
        monday = now - timedelta(days=now.weekday())
        monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
        sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
        query = query.where(
            Assignment.due_date >= monday,
            Assignment.due_date <= sunday,
        )

    query = query.order_by(Assignment.due_date.asc().nullslast())
    result = await db.execute(query)
    return [_to_response(a) for a in result.scalars().all()]


async def create_assignment(
    db: AsyncSession, user_id: uuid.UUID, request: AssignmentCreate
) -> dict:
    assignment = Assignment(
        user_id=user_id,
        title=request.title,
        description=request.description,
        subject=request.subject,
        due_date=request.due_date,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return _to_response(assignment)


async def _get_own(
    db: AsyncSession, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> Assignment:
    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.user_id == user_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=404,
            detail={"code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다"},
        )
    return assignment


async def update_assignment(
    db: AsyncSession,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    request: AssignmentUpdate,
) -> dict:
    assignment = await _get_own(db, user_id, assignment_id)
    values = request.model_dump(exclude_unset=True)

    if "is_completed" in values and values["is_completed"] and not assignment.is_completed:
        values["completed_at"] = _now()
    elif "is_completed" in values and not values["is_completed"]:
        values["completed_at"] = None

    if values:
        await db.execute(
            update(Assignment)
            .where(Assignment.id == assignment_id)
            .values(**values)
        )
        await db.commit()

    await db.refresh(assignment)
    return _to_response(assignment)


async def delete_assignment(
    db: AsyncSession, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> None:
    await _get_own(db, user_id, assignment_id)
    await db.execute(
        delete(Assignment).where(Assignment.id == assignment_id)
    )
    await db.commit()


async def get_pending_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Assignment.id)).where(
            Assignment.user_id == user_id,
            Assignment.is_completed == False,
        )
    )
    return result.scalar() or 0
