import uuid
import types

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import verify_token
from core.cache import cache_get, cache_set

USER_CACHE_TTL = 300  # 5분

security = HTTPBearer()


def _user_cache_key(user_id: uuid.UUID) -> str:
    return f"user:{user_id}"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    JWT Access Token 검증 → Redis 캐시 확인 → (미스 시) DB 조회 → User 반환.
    deleted_at이 있는 계정은 401 반환.
    """
    from models.user import User

    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=401,
        detail={"code": "INVALID_TOKEN", "message": "유효하지 않은 토큰입니다"},
    )

    try:
        payload = verify_token(token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exception

    # ── 캐시 확인 ─────────────────────────────────────────────────────────────
    cached = await cache_get(_user_cache_key(user_id))
    if cached:
        # 캐시 히트: SimpleNamespace로 ORM 객체처럼 속성 접근 가능하게 반환
        cached["id"] = uuid.UUID(cached["id"])
        return types.SimpleNamespace(**cached)

    # ── DB 조회 (캐시 미스) ───────────────────────────────────────────────────
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "USER_NOT_FOUND", "message": "존재하지 않는 사용자입니다"},
        )

    # 캐시 저장 (직렬화 가능한 필드만)
    await cache_set(_user_cache_key(user_id), {
        "id": str(user.id),
        "username": user.username,
        "name": user.name,
        "email": user.email,
        "department": user.department,
        "grade": user.grade,
        "role": user.role,
        "fcm_token": user.fcm_token,
        "notification_settings": user.notification_settings,
    }, ttl=USER_CACHE_TTL)

    return user


async def invalidate_user_cache(user_id: uuid.UUID) -> None:
    """프로필 수정/탈퇴 시 호출"""
    from core.cache import cache_delete
    await cache_delete(_user_cache_key(user_id))
