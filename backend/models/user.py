"""
사용자 및 인증 관련 모델
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from datetime import datetime

from backend.database import Base


class User(Base):
    """
    사용자 계정 정보
    
    - 한신대 이메일(school_email) 기반 회원
    - 비밀번호는 password_hash에 해시만 저장
    """

    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)

    # 로그인 계정 정보
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    # 프로필/학교 정보
    name = Column(String(100), nullable=False)
    school_email = Column(String(200), unique=True, nullable=False)
    department = Column(String(100), nullable=True, comment="학과")
    grade = Column(Integer, nullable=True, comment="학년")

    # 계정 상태/인증 정보
    status = Column(String(20), nullable=False, default="active")  # active/blocked/pending 등
    email_verified_at = Column(DateTime, nullable=True)

    # 레거시/확장용 컬럼 (기존 스키마 호환용, 현재는 사용하지 않음)
    email = Column(String(200), unique=False, nullable=True)
    school = Column(String(100), nullable=True, comment="학교명(레거시)")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(id={self.user_id}, username='{self.username}')>"


class EmailVerification(Base):
    """
    학교 이메일 인증(OTP) 정보

    - 인증번호 원문은 저장하지 않고 해시(code_hash)만 저장
    - purpose: signup 등 목적 구분
    """

    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    school_email = Column(String(200), index=True, nullable=False)
    purpose = Column(String(50), nullable=False)
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index(
            "ix_email_verifications_email_purpose",
            "school_email",
            "purpose",
        ),
    )


class RefreshToken(Base):
    """
    (확장용) 리프레시 토큰 관리

    - 현재는 발급/검증 로직에서 사용하지 않을 수 있지만
      추후 토큰 무효화/로그아웃을 위해 스키마만 정의
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
