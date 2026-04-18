from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[datetime] = None


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: Optional[bool] = None


class AssignmentResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
