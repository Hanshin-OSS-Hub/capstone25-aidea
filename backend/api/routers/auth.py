"""
인증/회원가입/마이페이지 API 라우터

- 이메일 인증(학교 이메일 로컬파트 + @hs.ac.kr)
- 회원가입 / 로그인
- 마이페이지(현재 로그인한 사용자 정보 조회)
"""

import os
import re
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import boto3
from fastapi import APIRouter, Depends, Query, Header
from fastapi import status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User, EmailVerification
from backend.api.responses import success_response
from backend.api.exceptions import ValidationError, ConflictError, NotFoundError, InternalError
from backend.api.schemas import ErrorDetail

import bcrypt


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ========================
# 환경 변수 / 상수
# ========================

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL", "no-reply@example.com")
EMAIL_CODE_TTL_SECONDS = int(os.getenv("EMAIL_CODE_TTL_SECONDS", "600"))
EMAIL_CODE_MAX_ATTEMPTS = int(os.getenv("EMAIL_CODE_MAX_ATTEMPTS", "5"))

SCHOOL_EMAIL_DOMAIN = "@hs.ac.kr"
EMAIL_LOCALPART_REGEX = re.compile(r"^[a-zA-Z0-9._-]{3,30}$")

security_scheme = HTTPBearer(auto_error=False)


# ========================
# Pydantic 스키마
# ========================


class CheckUsernameResponse(BaseModel):
    available: bool


class SendEmailCodeRequest(BaseModel):
    emailLocalPart: str = Field(..., description="학교 이메일 로컬파트 (예: rache123)")


class SendEmailCodeResponse(BaseModel):
    sent: bool
    expiresIn: int


class VerifyEmailCodeRequest(BaseModel):
    emailLocalPart: str
    code: str


class VerifyEmailCodeResponse(BaseModel):
    verified: bool


class SignupRequest(BaseModel):
    username: str
    password: str
    name: str
    emailLocalPart: str
    department: Optional[str] = None
    grade: Optional[int] = None


class UserProfile(BaseModel):
    user_id: int
    username: str
    name: str
    school_email: str
    department: Optional[str] = None
    grade: Optional[int] = None


class SignupResponseData(BaseModel):
    user: UserProfile
    accessToken: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponseData(BaseModel):
    accessToken: str


class MeResponseData(UserProfile):
    pass


# ========================
# 유틸 함수
# ========================


def _validate_email_local_part(email_local_part: str):
    if not EMAIL_LOCALPART_REGEX.match(email_local_part):
        raise ValidationError(
            "Invalid email local part.",
            details=[
                ErrorDetail(field="emailLocalPart", reason="must match ^[a-zA-Z0-9._-]{3,30}$")
            ],
        )


def _build_school_email(email_local_part: str) -> str:
    return f"{email_local_part}{SCHOOL_EMAIL_DOMAIN}"


def _hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def _hash_code(code: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(code.encode("utf-8"), salt).decode("utf-8")


def _verify_code(code: str, code_hash: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode("utf-8"), code_hash.encode("utf-8"))
    except Exception:
        return False


def _create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def _send_verification_email(school_email: str, code: str):
    """
    AWS SES를 이용해 인증번호 이메일 발송
    """
    try:
        client = boto3.client("ses", region_name=AWS_REGION)
        subject = "[AIdea] 학교 이메일 인증번호"
        body_text = f"AIdea 이메일 인증번호는 {code} 입니다.\n\n10분 이내에 입력해주세요."

        client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={"ToAddresses": [school_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                },
            },
        )
    except Exception as e:
        logger.error(f"SES 이메일 발송 실패: {e}")
        raise InternalError("Failed to send verification email.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Authorization 헤더의 Bearer 토큰으로 현재 사용자 조회
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ValidationError(
            "Authorization header missing.",
            details=[ErrorDetail(field="Authorization", reason="Bearer token required")],
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise ValidationError("Invalid token payload.")
    except JWTError:
        raise ValidationError("Invalid or expired token.")

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise NotFoundError("User not found.")
    if user.status != "active":
        raise ValidationError("User is not active.")

    return user


# ========================
# API 엔드포인트
# ========================


@router.get("/check-username")
async def check_username(
    username: str = Query(..., description="중복 확인할 아이디"),
    db: Session = Depends(get_db),
):
    """
    아이디(username) 중복 확인

    GET /api/v1/auth/check-username?username=...
    """
    exists = db.query(User).filter(User.username == username).first() is not None
    return success_response(CheckUsernameResponse(available=not exists).dict())


@router.post("/email/send-code")
async def send_email_code(
    request: SendEmailCodeRequest,
    db: Session = Depends(get_db),
):
    """
    학교 이메일 인증번호 발송

    POST /api/v1/auth/email/send-code
    Body: {"emailLocalPart": "rache123"}
    """
    _validate_email_local_part(request.emailLocalPart)
    school_email = _build_school_email(request.emailLocalPart)

    # 6자리 숫자 코드 생성
    import random

    code = f"{random.randint(0, 999999):06d}"

    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=EMAIL_CODE_TTL_SECONDS)

    existing = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.school_email == school_email,
            EmailVerification.purpose == "signup",
        )
        .first()
    )

    code_hash = _hash_code(code)

    if existing:
        existing.code_hash = code_hash
        existing.expires_at = expires_at
        existing.attempt_count = 0
        existing.verified_at = None
        existing.created_at = now
    else:
        ev = EmailVerification(
            school_email=school_email,
            purpose="signup",
            code_hash=code_hash,
            expires_at=expires_at,
            attempt_count=0,
        )
        db.add(ev)

    db.commit()

    # 이메일 발송
    _send_verification_email(school_email, code)

    return success_response(
        SendEmailCodeResponse(sent=True, expiresIn=EMAIL_CODE_TTL_SECONDS).dict()
    )


@router.post("/email/verify-code")
async def verify_email_code(
    request: VerifyEmailCodeRequest,
    db: Session = Depends(get_db),
):
    """
    학교 이메일 인증번호 검증

    POST /api/v1/auth/email/verify-code
    """
    _validate_email_local_part(request.emailLocalPart)
    school_email = _build_school_email(request.emailLocalPart)

    ev = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.school_email == school_email,
            EmailVerification.purpose == "signup",
        )
        .first()
    )

    now = datetime.utcnow()

    if not ev:
        raise ValidationError(
            "Verification code not found.",
            details=[ErrorDetail(field="code", reason="no code issued for this email")],
        )

    if ev.expires_at < now:
        raise ValidationError(
            "Verification code expired.",
            details=[ErrorDetail(field="code", reason="expired")],
        )

    if ev.attempt_count >= EMAIL_CODE_MAX_ATTEMPTS:
        raise ValidationError(
            "Too many attempts.",
            details=[ErrorDetail(field="code", reason="max attempts exceeded")],
        )

    # 시도 횟수 증가
    ev.attempt_count += 1
    db.commit()
    db.refresh(ev)

    if not _verify_code(request.code, ev.code_hash):
        raise ValidationError(
            "Invalid verification code.",
            details=[ErrorDetail(field="code", reason="does not match")],
        )

    ev.verified_at = now
    db.commit()

    return success_response(VerifyEmailCodeResponse(verified=True).dict())


@router.post("/signup")
async def signup(
    request: SignupRequest,
    db: Session = Depends(get_db),
):
    """
    최종 회원가입(계정 생성)

    POST /api/v1/auth/signup
    """
    # username 중복 체크
    if db.query(User).filter(User.username == request.username).first():
        raise ConflictError("Username already exists.")

    _validate_email_local_part(request.emailLocalPart)
    school_email = _build_school_email(request.emailLocalPart)

    # 이메일 인증 여부 확인
    ev = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.school_email == school_email,
            EmailVerification.purpose == "signup",
        )
        .first()
    )

    if not ev or not ev.verified_at:
        raise ValidationError(
            "Email not verified.",
            details=[ErrorDetail(field="emailLocalPart", reason="email not verified")],
        )

    # school_email 중복 체크
    if db.query(User).filter(User.school_email == school_email).first():
        raise ConflictError("School email already in use.")

    # 비밀번호 해시 생성
    password_hash = _hash_password(request.password)

    user = User(
        username=request.username,
        password_hash=password_hash,
        name=request.name,
        school_email=school_email,
        department=request.department,
        grade=request.grade,
        status="active",
        email_verified_at=ev.verified_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Access Token 발급 (옵션)
    access_token = _create_access_token({"sub": user.user_id})

    profile = UserProfile(
        user_id=user.user_id,
        username=user.username,
        name=user.name,
        school_email=user.school_email,
        department=user.department,
        grade=user.grade,
    )

    data = SignupResponseData(user=profile, accessToken=access_token)
    return success_response(data.dict(), status_code=status.HTTP_201_CREATED)


@router.post("/login")
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    로그인

    POST /api/v1/auth/login
    Body: { "username": "...", "password": "..." }
    """
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not _verify_password(request.password, user.password_hash):
        raise ValidationError(
            "Invalid username or password.",
            details=[ErrorDetail(field="username", reason="invalid credentials")],
        )

    if user.status != "active":
        raise ValidationError("User is not active.")

    access_token = _create_access_token({"sub": user.user_id})
    data = LoginResponseData(accessToken=access_token)
    return success_response(data.dict())


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    현재 로그인한 사용자 정보 조회 (마이페이지)

    GET /api/v1/auth/me
    Authorization: Bearer <access_token>
    """
    profile = UserProfile(
        user_id=current_user.user_id,
        username=current_user.username,
        name=current_user.name,
        school_email=current_user.school_email,
        department=current_user.department,
        grade=current_user.grade,
    )
    data = MeResponseData(**profile.dict())
    return success_response(data.dict())

