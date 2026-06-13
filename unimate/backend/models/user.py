import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, SmallInteger, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    student_number: Mapped[str | None] = mapped_column(String(255), nullable=True)  # 9자리, 암호화 저장
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    grade: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    phone_enc: Mapped[str | None] = mapped_column(String(255), nullable=True)       # 암호화 저장
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="student")
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notification_settings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
