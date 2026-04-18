import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, hash_token
from models.user import User
from models.auth import EmailVerification, RefreshToken
from models.assignment import UserInterestTag
from schemas.auth import RegisterRequest, LoginResponse, TokenResponse, UserInfo
from services.email_service import send_verification_email, send_welcome_email

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── 아이디 중복 확인 ──────────────────────────────────────────────────────────

async def check_username(db: AsyncSession, username: str) -> bool:
    """사용 가능하면 True, 이미 사용 중이면 False."""
    result = await db.execute(
        select(User).where(User.username == username, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none() is None


# ── 이메일 인증번호 발송 ──────────────────────────────────────────────────────

async def send_verification(db: AsyncSession, redis, email: str) -> None:
    # 재전송 쿨다운 확인 (60초)
    cooldown_key = f"email:cooldown:{email}"
    if await redis.exists(cooldown_key):
        raise HTTPException(
            status_code=429,
            detail={"code": "COOLDOWN_ACTIVE", "message": "잠시 후 다시 시도해주세요 (60초)"},
        )

    code = _generate_code()
    expires_at = _now() + timedelta(seconds=settings.EMAIL_VERIFY_CODE_TTL)

    # DB 저장 (기존 미인증 레코드 삭제 후 새로 삽입)
    await db.execute(
        delete(EmailVerification).where(
            EmailVerification.email == email,
            EmailVerification.is_verified == False,
        )
    )
    verification = EmailVerification(
        email=email,
        code=code,
        is_verified=False,
        expires_at=expires_at,
    )
    db.add(verification)
    await db.commit()

    # Redis 캐시
    verify_key = f"verify:{email}"
    await redis.setex(verify_key, settings.EMAIL_VERIFY_CODE_TTL, code)

    # 쿨다운 키 설정
    await redis.setex(cooldown_key, 60, "1")

    # 이메일 발송 (실패해도 예외 X)
    await send_verification_email(to=email, code=code)


# ── 인증번호 확인 ─────────────────────────────────────────────────────────────

async def verify_email(db: AsyncSession, redis, email: str, code: str) -> bool:
    verify_key = f"verify:{email}"

    # 1) Redis에서 먼저 확인
    cached_code = await redis.get(verify_key)
    if cached_code:
        if cached_code != code:
            raise HTTPException(
                status_code=400,
                detail={"code": "CODE_INVALID", "message": "인증번호가 올바르지 않습니다"},
            )
        # Redis 키 삭제
        await redis.delete(verify_key)
    else:
        # 2) DB에서 확인
        result = await db.execute(
            select(EmailVerification)
            .where(EmailVerification.email == email, EmailVerification.is_verified == False)
            .order_by(EmailVerification.created_at.desc())
        )
        verification = result.scalar_one_or_none()

        if not verification:
            raise HTTPException(
                status_code=400,
                detail={"code": "CODE_INVALID", "message": "인증번호가 올바르지 않습니다"},
            )
        if verification.expires_at < _now():
            raise HTTPException(
                status_code=400,
                detail={"code": "CODE_EXPIRED", "message": "인증번호가 만료됐습니다. 재발송해주세요"},
            )
        if verification.code != code:
            raise HTTPException(
                status_code=400,
                detail={"code": "CODE_INVALID", "message": "인증번호가 올바르지 않습니다"},
            )

    # is_verified = True 업데이트
    await db.execute(
        update(EmailVerification)
        .where(EmailVerification.email == email)
        .values(is_verified=True)
    )
    await db.commit()
    return True


# ── 회원가입 ──────────────────────────────────────────────────────────────────

async def register(db: AsyncSession, request: RegisterRequest) -> User:
    # 이메일 인증 완료 여부 확인
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.email == request.email,
            EmailVerification.is_verified == True,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail={"code": "EMAIL_NOT_VERIFIED", "message": "이메일 인증을 먼저 완료해주세요"},
        )

    # username 중복 확인
    if not await check_username(db, request.username):
        raise HTTPException(
            status_code=409,
            detail={"code": "USERNAME_TAKEN", "message": "이미 사용 중인 아이디입니다"},
        )

    # 이메일 중복 확인
    result = await db.execute(
        select(User).where(User.email == request.email, User.deleted_at.is_(None))
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_ALREADY_USED", "message": "이미 가입된 이메일입니다"},
        )

    # 유저 생성
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        name=request.name,
        student_number=request.student_number,
        department=request.department,
        grade=request.grade,
        phone_enc=request.phone,
        email=request.email,
        role="student",
    )
    db.add(user)
    await db.flush()  # user.id 확보

    # 관심 태그 저장
    for tag in request.interest_tags:
        db.add(UserInterestTag(user_id=user.id, tag=tag))

    await db.commit()
    await db.refresh(user)

    # 환영 이메일 발송
    await send_welcome_email(to=user.email, name=user.name)

    return user


# ── 로그인 ───────────────────────────────────────────────────────────────────

async def login(db: AsyncSession, username: str, password: str) -> LoginResponse:
    try:
        result = await db.execute(
            select(User).where(User.username == username, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=401,
                detail={"code": "USER_NOT_FOUND", "message": "아이디 또는 비밀번호가 올바르지 않습니다"},
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=401,
                detail={"code": "INVALID_PASSWORD", "message": "아이디 또는 비밀번호가 올바르지 않습니다"},
            )

        access_token = create_access_token(user.id)
        refresh_token_str = create_refresh_token(user.id)

        # Refresh Token DB 저장
        expires_at = _now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
        db.add(RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token_str),
            expires_at=expires_at,
        ))
        await db.commit()

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            user=UserInfo(
                id=str(user.id),
                name=user.name,
                department=user.department,
                grade=user.grade,
            ),
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise


# ── 토큰 갱신 (Rotation) ──────────────────────────────────────────────────────

async def refresh_token(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    token_hash = hash_token(refresh_token_str)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored = result.scalar_one_or_none()

    if not stored:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "유효하지 않은 Refresh Token입니다"},
        )

    if stored.expires_at < _now():
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_EXPIRED", "message": "Refresh Token이 만료됐습니다. 다시 로그인해주세요"},
        )

    user_id: uuid.UUID = stored.user_id

    # 기존 토큰 revoke
    stored.revoked_at = _now()
    await db.flush()

    # 새 토큰 발급
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)

    expires_at = _now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=hash_token(new_refresh),
        expires_at=expires_at,
    ))
    await db.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


# ── 비밀번호 변경 ─────────────────────────────────────────────────────────────

async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_PASSWORD", "message": "현재 비밀번호가 올바르지 않습니다"},
        )

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(password_hash=hash_password(new_password))
    )
    # 기존 Refresh Token 전부 revoke (보안상 재로그인 유도)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    await db.commit()


# ── 회원탈퇴 (소프트 딜리트) ──────────────────────────────────────────────────

async def withdraw(db: AsyncSession, user: User) -> None:
    # 소프트 딜리트
    await db.execute(
        update(User).where(User.id == user.id).values(deleted_at=_now())
    )
    # Refresh Token 전부 revoke
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    await db.commit()
