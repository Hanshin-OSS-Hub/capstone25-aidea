"""
DB 쿼리 로깅 모듈

- SQLAlchemy 이벤트 리스너로 쿼리 실행 시간 측정
- ContextVar로 요청-쿼리 연결 (미들웨어와 연동)
- logs/db.log 파일에 기록
"""
import logging
import re
import time
from contextvars import ContextVar
from sqlalchemy import event
from sqlalchemy.engine import Engine

# 요청별 쿼리 카운터 (미들웨어와 공유)
_query_count: ContextVar[list] = ContextVar("query_count", default=None)

db_logger = logging.getLogger("db")


def get_query_stats() -> dict:
    stats = _query_count.get()
    if stats is None:
        return {"count": 0, "total_ms": 0.0}
    return {"count": len(stats), "total_ms": round(sum(stats), 2)}


def reset_query_stats():
    _query_count.set([])


def _extract_table(statement: str) -> str:
    """SQL에서 주 테이블명 추출"""
    stmt = statement.strip().upper()
    patterns = [
        r"FROM\s+([a-z_]+)",
        r"INTO\s+([a-z_]+)",
        r"UPDATE\s+([a-z_]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, statement, re.IGNORECASE)
        if match:
            return match.group(1).lower()
    return "unknown"


def _get_operation(statement: str) -> str:
    stmt = statement.strip().upper()
    for op in ("SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER"):
        if stmt.startswith(op):
            return op
    return "QUERY"


def setup_db_logging(engine: Engine):
    """엔진에 이벤트 리스너 등록 — database.py에서 호출"""

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def before_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info["query_start"] = time.monotonic()

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def after_execute(conn, cursor, statement, parameters, context, executemany):
        elapsed_ms = (time.monotonic() - conn.info.get("query_start", time.monotonic())) * 1000
        elapsed_ms = round(elapsed_ms, 2)

        operation = _get_operation(statement)
        table = _extract_table(statement)

        # 행 수 추출 시도
        try:
            row_count = cursor.rowcount if cursor.rowcount >= 0 else None
        except Exception:
            row_count = None

        row_info = f" | {row_count}rows" if row_count is not None else ""

        db_logger.debug(
            f"[SQL] {operation} {table} ({elapsed_ms}ms){row_info}"
        )

        # 요청 컨텍스트에 누적
        stats = _query_count.get()
        if stats is not None:
            stats.append(elapsed_ms)

        # 느린 쿼리 경고 (100ms 초과)
        if elapsed_ms > 100:
            db_logger.warning(
                f"[SLOW QUERY] {elapsed_ms}ms — {statement[:200].strip()}"
            )
