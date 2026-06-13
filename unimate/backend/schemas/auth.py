import re
from typing import List

from pydantic import BaseModel, field_validator


# ── 요청 스키마 ───────────────────────────────────────────────────────────────

class UsernameCheckRequest(BaseModel):
    username: str


class SendVerificationRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v.endswith("@hs.ac.kr"):
            raise ValueError("한신대학교 이메일(@hs.ac.kr)만 사용 가능합니다")
        return v.lower()


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    student_number: str
    department: str
    grade: int
    phone: str
    email: str
    interest_tags: List[str] = []

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9]{4,20}$", v):
            raise ValueError("아이디는 영문 소문자+숫자 4~20자입니다")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.match(r"^(?=.*[a-zA-Z])(?=.*\d).{8,}$", v):
            raise ValueError("비밀번호는 영문+숫자 조합 8자 이상입니다")
        return v

    @field_validator("student_number")
    @classmethod
    def validate_student_number(cls, v: str) -> str:
        if not re.match(r"^\d{9}$", v):
            raise ValueError("학번은 9자리 숫자입니다")
        return v

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("학년은 1~4 사이여야 합니다")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not re.match(r"^(?=.*[a-zA-Z])(?=.*\d).{8,}$", v):
            raise ValueError("비밀번호는 영문+숫자 조합 8자 이상입니다")
        return v


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class UserInfo(BaseModel):
    id: str
    name: str
    department: str
    grade: int

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserInfo


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
