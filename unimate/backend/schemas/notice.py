from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class NoticeList(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    published_at: Optional[datetime] = None
    source_type: Optional[str] = None
    is_bookmarked: bool = False

    class Config:
        from_attributes = True


class NoticeDetail(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    published_at: Optional[datetime] = None
    source_type: Optional[str] = None
    is_bookmarked: bool = False
    content: Optional[str] = None
    summary: Optional[str] = None
    source_url: Optional[str] = None

    class Config:
        from_attributes = True


class NoticeSummaryResponse(BaseModel):
    summary: Optional[str] = None


class UnreadCountResponse(BaseModel):
    count: int
