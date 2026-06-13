# UniMate — Backend 개발 규칙

> FastAPI + Python 3.11+ | 이 파일의 규칙을 항상 따를 것

---

## 디렉토리 구조

```
backend/
├── main.py                  # FastAPI 앱, 라우터 등록, CORS, 전역 예외 핸들러
├── requirements.txt
├── core/
│   ├── config.py            # pydantic-settings (OPENAI_LLM_MODEL 포함)
│   ├── database.py          # SQLAlchemy async 엔진 + 세션
│   ├── redis.py             # Redis 연결
│   ├── security.py          # JWT 발급/검증, bcrypt (passlib + bcrypt==4.0.1)
│   ├── dependencies.py      # HTTPBearer + get_current_user
│   └── response.py          # success(), error() 헬퍼
├── models/                  # SQLAlchemy ORM 모델
│   ├── __init__.py          # QaDocument 포함한 전체 모델 export
│   ├── notice.py            # Notice (embedding 컬럼 포함)
│   ├── qa_document.py       # QaDocument (PDF 청크 + embedding)
│   └── ...
├── schemas/                 # Pydantic 요청/응답 스키마
├── routers/                 # 엔드포인트 (비즈니스 로직 없음)
│   ├── auth.py
│   ├── users.py
│   ├── notices.py
│   ├── assignments.py
│   ├── schedules.py
│   ├── chat.py              # SSE 스트리밍 + daily-summary
│   └── admin.py             # PDF 업로드 (admin 전용)
├── services/                # 비즈니스 로직
│   ├── chat_service.py      # run_agent, get_daily_summary
│   └── ...
├── ai/                      # AI Agent + Embeddings
│   ├── agent.py             # ScholarshipAgent (Claude claude-sonnet-4-5)
│   ├── embeddings.py        # embed_notice, embed_pdf_chunk
│   └── tools/
│       ├── fetch_notices.py     # ILIKE 키워드 검색
│       ├── search_by_deadline.py # 마감 임박 검색
│       └── answer_faq.py        # 벡터 검색 (notices + qa_documents)
├── crawler/                 # Celery 크롤러
│   ├── spiders/
│   │   └── notice_crawler.py   # 한신대 6개 카테고리
│   ├── worker.py               # Celery 앱 + beat_schedule
│   └── scheduler.py           # Celery Beat 진입점
├── migrations/              # Alembic
└── tests/
```

---

## 레이어 책임 규칙

| 레이어 | 역할 | 금지 사항 |
| --- | --- | --- |
| `routers/` | 요청 수신, 스키마 검증, 서비스 호출, 응답 반환 | 직접 DB 쿼리 금지 |
| `services/` | 비즈니스 로직, DB 접근, 외부 API 호출 | HTTP 요청/응답 처리 금지 |
| `models/` | DB 테이블 정의 | 비즈니스 로직 금지 |
| `schemas/` | 요청/응답 데이터 구조 정의 | DB 접근 금지 |

---

## main.py 구조

```python
import logging
logging.basicConfig(level=logging.INFO)  # 반드시 import 전에 설정

import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import auth, users, notices, assignments, schedules, chat, admin

logger = logging.getLogger(__name__)

app = FastAPI(title="UniMate API", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"전역 예외 발생: {request.method} {request.url} → {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": str(exc)})

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/v1/users",       tags=["users"])
app.include_router(notices.router,     prefix="/api/v1/notices",     tags=["notices"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(schedules.router,   prefix="/api/v1/schedules",   tags=["schedules"])
app.include_router(chat.router,        prefix="/api/v1/chat",        tags=["chat"])
app.include_router(admin.router,       prefix="/api/v1/admin",       tags=["admin"])
```

> **중요**: `logging.basicConfig()`는 반드시 모든 import보다 먼저 실행해야 초기 모듈 로그가 누락되지 않음.

---

## 공통 응답 헬퍼

모든 라우터는 아래 헬퍼를 사용. 직접 dict 반환 금지.

```python
# core/response.py
def success(data) -> dict:
    return {"success": True, "data": data, "error": None}

def error(code: str, message: str) -> dict:
    return {"success": False, "data": None, "error": {"code": code, "message": message}}
```

---

## 비동기 규칙

- 모든 DB 접근은 `async/await` 사용
- `asyncpg` 드라이버 사용 (`postgresql+asyncpg://`)
- 크롤러에서 async 호출 시 `asyncio.run()` 사용 (Celery 태스크 내부)

---

## 알려진 호환성 이슈

- **passlib + bcrypt + Python 3.14**: `passlib==1.7.4`는 Python 3.14에서 동작 불가. `passlib` 제거하고 `bcrypt`를 직접 사용 (`core/security.py` 참고)
- **개발 서버 실행**: 모바일 기기에서 접속하려면 `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

---

## 금지 사항

- 라우터에서 직접 DB 쿼리 작성 금지
- `print()` 디버깅 금지 → `logging` 모듈 사용
- 비밀번호/토큰 원문 로그 출력 금지
- `requests` 라이브러리 사용 금지 → `httpx` 사용
- 동기 함수에서 DB 접근 금지 → 반드시 `async def`
