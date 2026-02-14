# crawler_app/storage/storage_pg.py
"""
PostgreSQL 저장 모듈

- notices: List[Dict] 형태의 공지 데이터를 받아 DB에 저장
- url을 UNIQUE 키로 보고 ON CONFLICT (url) DO NOTHING 으로 중복 저장 방지
- attachments/images는 "인식만" 된 상태를 JSONB로 저장 가능(다운로드 X)
- print 대신 logging 사용
"""

from __future__ import annotations

import os
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


# -------------------------
# Connection
# -------------------------
def _require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def get_conn():
    """
    환경변수:
      PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD
    """
    return psycopg2.connect(
        host=_require_env("PG_HOST"),
        port=int(_require_env("PG_PORT")),
        dbname=_require_env("PG_DB"),
        user=_require_env("PG_USER"),
        password=_require_env("PG_PASSWORD"),
    )


# -------------------------
# Helpers
# -------------------------
def _utc_now_iso() -> str:
    # DB 컬럼이 timestamptz면 psycopg2가 datetime도 잘 처리함.
    # 하지만 Dict 기반으로 넣을 때 문자열이 편해서 ISO로 통일.
    return datetime.now(timezone.utc).isoformat()


def _hash_text(text: str) -> str:
    text = (text or "").strip()
    return hashlib.sha256(text.encode("utf-8")).hexdigest() if text else ""


def _to_jsonb(value: Any) -> Any:
    """
    psycopg2.extras.Json 로 감싸 JSONB에 안전하게 넣기 위한 변환
    - None -> []
    - dict/list -> 그대로
    - str -> str (단, JSON string이면 파싱 시도)
    """
    if value is None:
        value = []
    if isinstance(value, str):
        s = value.strip()
        if (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")):
            try:
                value = json.loads(s)
            except Exception:
                pass
    return psycopg2.extras.Json(value)


def _normalize_notice(n: Dict[str, Any]) -> Dict[str, Any]:
    """
    DB insert에 필요한 키를 채우고, 없으면 기본값/파생값을 만든다.
    기대 키(권장):
      source, title, url, posted_date, category, content_text
      attachments(optional), images(optional), crawled_at(optional)
    """
    content_text = (n.get("content_text") or n.get("content") or "").strip()

    normalized: Dict[str, Any] = {
        "source": n.get("source") or "unknown",
        "title": n.get("title") or "",
        "url": n.get("url") or "",
        "posted_date": n.get("posted_date"),  # DB 타입(date/timestamp)에 맞춰 spider에서 정규화 권장
        "category": n.get("category"),
        "content_text": content_text,
        "content_hash": n.get("content_hash") or _hash_text(content_text),
        "attachments": _to_jsonb(n.get("attachments") or n.get("attachments_detected") or []),
        "images": _to_jsonb(n.get("images") or n.get("images_detected") or []),
        "crawled_at": n.get("crawled_at") or _utc_now_iso(),
    }
    return normalized


# -------------------------
# Save
# -------------------------
def save_notices(notices: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    returns:
      { "total": N, "inserted": X, "skipped": Y, "failed": Z }
    """
    sql = """
    INSERT INTO notices (
        source, title, url, posted_date, category,
        content_text, content_hash,
        attachments, images, crawled_at
    )
    VALUES (
        %(source)s, %(title)s, %(url)s, %(posted_date)s, %(category)s,
        %(content_text)s, %(content_hash)s,
        %(attachments)s::jsonb, %(images)s::jsonb, %(crawled_at)s
    )
    ON CONFLICT (url) DO NOTHING;
    """

    inserted = 0
    skipped = 0
    failed = 0
    total = len(notices)

    if total == 0:
        logger.info("save_notices: no notices to save.")
        return {"total": 0, "inserted": 0, "skipped": 0, "failed": 0}

    # url 없는 데이터는 실패로 처리(중복 방지 키가 없어서 저장 기준이 애매함)
    normalized_batch: List[Dict[str, Any]] = []
    for n in notices:
        nn = _normalize_notice(n)
        if not nn["url"]:
            failed += 1
            logger.warning("save_notices: skipped (missing url). title=%s", nn.get("title"))
            continue
        normalized_batch.append(nn)

    if not normalized_batch:
        return {"total": total, "inserted": 0, "skipped": 0, "failed": failed}

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                for n in normalized_batch:
                    try:
                        cur.execute(sql, n)
                        if cur.rowcount == 1:
                            inserted += 1
                        else:
                            skipped += 1
                    except Exception as e:
                        failed += 1
                        logger.exception("DB insert failed. url=%s err=%s", n.get("url"), e)
            conn.commit()
    except Exception as e:
        # 커넥션/트랜잭션 단위 실패
        logger.exception("DB connection or transaction failed. err=%s", e)
        # 이 경우 남은 배치가 전부 실패했다고 보는 게 맞음(정확한 실패 수가 필요하면 더 세분화 가능)
        failed += len(normalized_batch)
        inserted = 0
        skipped = 0

    logger.info(
        "save_notices done. total=%d inserted=%d skipped=%d failed=%d",
        total, inserted, skipped, failed
    )
    return {"total": total, "inserted": inserted, "skipped": skipped, "failed": failed}
