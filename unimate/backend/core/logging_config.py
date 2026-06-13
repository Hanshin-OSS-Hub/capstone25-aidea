"""
로깅 설정

logs/
  app.log        — 전체 INFO 이상 로그 (공통)
  error.log      — ERROR 이상만 (공통)
  db/
    query.log    — SQL 쿼리 실행시간
    request.log  — API 요청별 DB 쿼리 횟수 요약
  ai/
    chat.log     — AI 챗봇 단계별 소요시간 (캐시/LLM/도구/총합)
"""
import logging
import logging.handlers
from pathlib import Path


def setup_logging(app_env: str = "development"):
    logs_dir = Path(__file__).parent.parent / "logs"
    db_dir   = logs_dir / "db"
    ai_dir   = logs_dir / "ai"

    logs_dir.mkdir(exist_ok=True)
    db_dir.mkdir(exist_ok=True)
    ai_dir.mkdir(exist_ok=True)

    fmt_detailed = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    fmt_simple = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    def make_handler(path: Path, level: int) -> logging.handlers.RotatingFileHandler:
        h = logging.handlers.RotatingFileHandler(
            path, maxBytes=10 * 1024 * 1024, backupCount=7, encoding="utf-8"
        )
        h.setLevel(level)
        h.setFormatter(fmt_detailed)
        return h

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    # ── 콘솔 (INFO 이상) ──────────────────────────────────────────────────────
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(fmt_simple)
    root_logger.addHandler(console)

    # ── logs/app.log (INFO 이상, 공통) ───────────────────────────────────────
    root_logger.addHandler(make_handler(logs_dir / "app.log", logging.INFO))

    # ── logs/error.log (ERROR 이상, 공통) ────────────────────────────────────
    root_logger.addHandler(make_handler(logs_dir / "error.log", logging.ERROR))

    # ── logs/db/query.log (DB 쿼리) ───────────────────────────────────────────
    db_logger = logging.getLogger("db")
    db_logger.setLevel(logging.DEBUG)
    db_logger.addHandler(make_handler(db_dir / "query.log", logging.DEBUG))
    db_logger.propagate = False  # app.log 중복 방지

    # ── logs/db/request.log (API별 DB 요약) ──────────────────────────────────
    req_logger = logging.getLogger("request")
    req_logger.setLevel(logging.INFO)
    req_logger.addHandler(make_handler(db_dir / "request.log", logging.INFO))
    req_logger.propagate = True  # app.log에도 기록

    # ── logs/ai/chat.log (AI 챗봇 타이밍) ────────────────────────────────────
    ai_logger = logging.getLogger("ai")
    ai_logger.setLevel(logging.DEBUG)
    ai_logger.addHandler(make_handler(ai_dir / "chat.log", logging.DEBUG))
    ai_logger.propagate = True  # app.log에도 기록

    # SQLAlchemy / httpx 내부 로그 억제
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
