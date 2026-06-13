import logging
from contextlib import asynccontextmanager

from core.logging_config import setup_logging
from core.config import settings as _settings_early
setup_logging(_settings_early.APP_ENV)

logger = logging.getLogger(__name__)

import time
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.db_logger import reset_query_stats, get_query_stats

from core.config import settings
from core.database import check_db_connection, enable_pgvector
from core.redis import check_redis_connection, close_redis

from routers import auth, users, notices, assignments, schedules, chat, admin


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    logger.info("UniMate API 시작 중...")

    db_ok = await check_db_connection()
    if not db_ok:
        logger.error("DB 연결 실패 — 서버를 종료합니다")
        raise RuntimeError("DB connection failed")

    await enable_pgvector()

    redis_ok = await check_redis_connection()
    if not redis_ok:
        logger.warning("Redis 연결 실패 — 캐시 기능이 비활성화됩니다")

    logger.info(f"서버 시작 완료 (환경: {settings.APP_ENV})")
    yield

    # shutdown
    await close_redis()
    logger.info("서버 종료")


# ── FastAPI 앱 ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="UniMate API",
    version="1.0.0",
    description="한신대학교 학생 AI 도우미 UniMate 백엔드",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB 쿼리 로깅 미들웨어 ─────────────────────────────────────────────────────

req_logger = logging.getLogger("request")

@app.middleware("http")
async def db_logging_middleware(request: Request, call_next):
    reset_query_stats()
    start = time.monotonic()

    response = await call_next(request)

    elapsed_ms = round((time.monotonic() - start) * 1000, 2)
    stats = get_query_stats()
    path = request.url.path

    # 헬스체크, 정적 파일은 제외
    if not path.startswith(("/health", "/docs", "/redoc", "/openapi")):
        req_logger.info(
            f"{request.method} {path} → {response.status_code} "
            f"| DB쿼리 {stats['count']}회 {stats['total_ms']}ms "
            f"| 총 {elapsed_ms}ms"
        )

    return response

# ── 라우터 등록 ───────────────────────────────────────────────────────────────

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/v1/users",       tags=["users"])
app.include_router(notices.router,     prefix="/api/v1/notices",     tags=["notices"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(schedules.router,   prefix="/api/v1/schedules",   tags=["schedules"])
app.include_router(chat.router,        prefix="/api/v1/chat",        tags=["chat"])
app.include_router(admin.router,      prefix="/api/v1/admin",       tags=["admin"])

# ── 전역 예외 핸들러 ──────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"전역 예외 발생: {request.method} {request.url} → {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# ── 헬스체크 ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    db_ok = await check_db_connection()
    redis_ok = await check_redis_connection()
    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "db": "connected" if db_ok else "disconnected",
        "redis": "connected" if redis_ok else "disconnected",
        "env": settings.APP_ENV,
    }
