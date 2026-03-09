"""
캘린더 관련 모델
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.database import Base


class CalendarEvent(Base):
    """캘린더 일정"""
    __tablename__ = "calendar_events"

    event_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(500), nullable=False)
    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=False)
    memo = Column(Text)
    
    # 일정 출처
    source = Column(String(20), nullable=False, comment="notice(공지 기반) / manual(수동)")
    notice_id = Column(Integer, ForeignKey("notices.notice_id", ondelete="SET NULL"), nullable=True, comment="공지 연계")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<CalendarEvent(id={self.event_id}, title='{self.title}', source={self.source})>"
