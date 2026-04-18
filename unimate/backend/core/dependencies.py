import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import verify_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    JWT Access Token 검증 → DB에서 User 조회 → User 반환.
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

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "USER_NOT_FOUND", "message": "존재하지 않는 사용자입니다"},
        )

    return user
