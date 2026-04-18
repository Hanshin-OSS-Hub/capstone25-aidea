from typing import Optional, List

from pydantic import BaseModel


class UserMe(BaseModel):
    id: str
    username: str
    name: str
    department: str
    grade: int
    email: str
    fcm_token: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    department: Optional[str] = None
    grade: Optional[int] = None
    fcm_token: Optional[str] = None


class NotificationSettingsRequest(BaseModel):
    notice: bool = True
    assignment: bool = True
    assignment_days: List[int] = [1, 3]
    academic: bool = True
    briefing: bool = True
    briefing_time: str = "09:00"
