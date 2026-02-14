"""
사용자 관련 모델
"""

from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

from backend.database import Base


class User(Base):
    """사용자 (MVP에서는 Mock, 추후 인증 구현)"""
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True)
    
    # 학교 정보 (추후 확장)
    school = Column(String(100), comment="학교명")
    grade = Column(Integer, comment="학년")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(id={self.user_id}, name='{self.name}')>"
