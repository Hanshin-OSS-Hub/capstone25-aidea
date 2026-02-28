"""
공지사항 관련 모델
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

from backend.database import Base


class Notice(Base):
    """공지사항 원본"""
    __tablename__ = "notices"

    notice_id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(64), unique=True, nullable=False, index=True, comment="크롤링 UID")
    title = Column(String(500), nullable=False, index=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True, comment="scholarship/academic/event/career")
    category_name = Column(String(50), comment="한글 카테고리명")
    original_url = Column(String(1000))
    posted_date = Column(Date, index=True, comment="게시일")
    crawled_at = Column(DateTime, default=datetime.utcnow)
    has_attachment = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ai_field = relationship("NoticeAIField", back_populates="notice", uselist=False)
    favorites = relationship("FavoriteNotice", back_populates="notice")

    def __repr__(self):
        return f"<Notice(id={self.notice_id}, title='{self.title[:30]}...')>"


class NoticeAIField(Base):
    """공지사항 AI 분석 결과"""
    __tablename__ = "notice_ai_fields"

    id = Column(Integer, primary_key=True, index=True)
    notice_id = Column(Integer, ForeignKey("notices.notice_id", ondelete="CASCADE"), unique=True)
    
    # AI 분석 결과
    summary = Column(ARRAY(Text), comment="3줄 요약")
    ai_category = Column(String(50), comment="AI가 분류한 카테고리")
    start_date = Column(Date, comment="시작일")
    end_date = Column(Date, comment="마감일")
    extracted_json = Column(JSONB, comment="추출된 JSON 데이터")
    
    # 처리 상태
    status = Column(String(20), default="pending", comment="pending/success/fail")
    error_message = Column(Text)
    analyzed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    notice = relationship("Notice", back_populates="ai_field")

    def __repr__(self):
        return f"<NoticeAIField(notice_id={self.notice_id}, status={self.status})>"


class FavoriteNotice(Base):
    """사용자 관심 공지"""
    __tablename__ = "favorite_notices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    notice_id = Column(Integer, ForeignKey("notices.notice_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Unique constraint
    __table_args__ = (
        {'comment': '사용자별 공지사항 관심 등록'},
    )

    # Relationships
    notice = relationship("Notice", back_populates="favorites")

    def __repr__(self):
        return f"<FavoriteNotice(user_id={self.user_id}, notice_id={self.notice_id})>"
