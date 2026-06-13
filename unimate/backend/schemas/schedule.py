from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    start_at: datetime
    end_at: Optional[datetime] = None
    is_allday: bool = False
    alert_days: Optional[List[int]] = None


class ScheduleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_allday: Optional[bool] = None
    is_completed: Optional[bool] = None
    alert_days: Optional[List[int]] = None


class ScheduleResponse(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    source: str = "user"
    start_at: datetime
    end_at: Optional[datetime] = None
    is_allday: bool = False
    alert_days: Optional[List[int]] = None

    class Config:
        from_attributes = True


class NextExamResponse(BaseModel):
    title: str
    start_at: datetime
    dday: int
