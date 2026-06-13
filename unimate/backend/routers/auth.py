from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.redis import get_redis
from core.response import success, error
from models.user import User
from schemas.auth import (
    SendVerificationRequest,
    VerifyEmailRequest,
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    PasswordChangeRequest,
)
import services.auth_service as auth_service

router = APIRouter()


# GET /check-username?username=
@router.get("/check-username")
async def check_username(
    username: str = Query(..., min_length=4, max_length=20),
    db: AsyncSession = Depends(get_db),
):
    """아이디 중복 확인. 사용 가능하면 200, 중복이면 409."""
    available = await auth_service.check_username(db, username)
    if not available:
        return JSONResponse(
            status_code=409,
            content=error("USERNAME_TAKEN", "이미 사용 중인 아이디입니다"),
        )
    return success({"available": True, "username": username})


# POST /send-verification
@router.post("/send-verification", status_code=200)
async def send_verification(
    body: SendVerificationRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """이메일 인증번호 발송."""
    await auth_service.send_verification(db, redis, body.email)
    return success({"message": "인증번호가 발송됐습니다"})


# POST /verify-email
@router.post("/verify-email", status_code=200)
async def verify_email(
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """인증번호 검증."""
    await auth_service.verify_email(db, redis, body.email, body.code)
    return success({"verified": True})


# POST /register
@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """회원가입."""
    user = await auth_service.register(db, body)
    return success({
        "id": str(user.id),
        "username": user.username,
        "name": user.name,
        "department": user.department,
        "grade": user.grade,
    })


# POST /login
@router.post("/login", status_code=200)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """로그인. access_token + refresh_token 반환."""
    try:
        result = await auth_service.login(db, body.username, body.password)
        return success(result.model_dump())
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise


# POST /refresh
@router.post("/refresh", status_code=200)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh Token으로 새 토큰 쌍 발급 (Rotation)."""
    result = await auth_service.refresh_token(db, body.refresh_token)
    return success(result.model_dump())


# POST /change-password  🔒
@router.post("/change-password", status_code=200)
async def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """비밀번호 변경. 변경 후 기존 Refresh Token 전부 revoke."""
    await auth_service.change_password(db, current_user, body.current_password, body.new_password)
    return success({"message": "비밀번호가 변경됐습니다. 다시 로그인해주세요"})


# DELETE /withdraw  🔒
@router.delete("/withdraw", status_code=200)
async def withdraw(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """회원탈퇴 (소프트 딜리트)."""
    await auth_service.withdraw(db, current_user)
    return success({"message": "탈퇴가 완료됐습니다"})
