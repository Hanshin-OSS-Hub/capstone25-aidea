# UniMate — 인증/인가 규칙

> JWT + Resend 이메일 인증 | 한신대(@hs.ac.kr) 전용

---

## 인증 흐름 요약

```
[회원가입]
기본정보 입력(Step1) → 이메일 인증번호 발송(Step2) → 코드 검증 → 관심사 선택(Step3) → 계정 생성 → 토큰 발급

[로그인]
username + password → bcrypt 비교 → Access Token(30분) + Refresh Token(14일)

[API 요청]
Authorization: Bearer <access_token> → 만료 시 /auth/refresh로 갱신

[회원탈퇴]
deleted_at 기록 (소프트 딜리트) → Refresh Token 전체 revoke
```

---

## 이메일 정책

- 대상: 한신대 학생만 → `@hs.ac.kr` 고정
- 입력: 사용자는 로컬파트만 입력 (`rache123`)
- 서버: `email = f"{emailLocalPart}@hs.ac.kr"` 로 조합

---

## get_current_user 의존성 (HTTPBearer 방식)

```python
# core/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.security import verify_token
from core.database import get_db
from models.user import User
import uuid

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = verify_token(token)
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "유효하지 않은 토큰입니다"})

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at == None)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail={"code": "USER_NOT_FOUND", "message": "존재하지 않는 사용자입니다"})

    return user
```

> **중요**: `OAuth2PasswordBearer`가 아닌 `HTTPBearer` 사용. Swagger UI에서 직접 Bearer 토큰 입력 가능.

---

## 보안 정책

### 비밀번호

- `passlib` + `bcrypt==4.0.1` 사용 (bcrypt 5.x와 비호환)
- 최소 8자, 영문+숫자 필수

### 인증번호

- 6자리 숫자
- TTL: 5분
- 재전송 쿨다운: 60초 (Redis `email:cooldown:{email}`)

### 토큰

- Access Token: **30분** → Zustand 메모리 저장
- Refresh Token: **14일** → expo-secure-store + DB `token_hash` (SHA-256) 저장
- 로그아웃/탈퇴 시 `refresh_tokens.revoked_at` 즉시 기록

---

## 금지 사항

- 비밀번호 원문 DB 저장 금지
- 비밀번호/토큰 원문 로그 출력 금지
- Access Token을 DB에 저장 금지 (stateless)
- `@hs.ac.kr` 외 도메인 이메일 허용 금지
- `deleted_at`이 NULL이 아닌 사용자 로그인 허용 금지
