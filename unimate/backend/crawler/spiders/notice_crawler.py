import os
import re
import time
import hashlib
import logging
from datetime import datetime, date, timezone
from typing import List, Dict, Optional, NamedTuple
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = logging.getLogger(__name__)

# ── 카테고리 설정 ──────────────────────────────────────────

BASE_URL = os.getenv("BASE_URL", "https://www.hs.ac.kr")


class Category(NamedTuple):
    category_code: str
    category_name: str
    list_url: str
    menu_id: str = ""


CATEGORIES = [
    Category("notice",      "공지사항",       "/kor/4953/subview.do", "4953"),
    Category("event",       "행사공지",       "/kor/4955/subview.do", "4955"),
    Category("academic",    "학사공지",       "/kor/4956/subview.do", "4956"),
    Category("scholarship", "장학·사회봉사",  "/kor/4957/subview.do", "4957"),
    Category("employment",  "취업공지",       "/kor/4958/subview.do", "4958"),
    Category("privacy",     "개인정보공지",   "/kor/4959/subview.do", "4959"),
]


def full_url(path: str) -> str:
    path = path.strip()
    if path.startswith("http"):
        return path
    base = BASE_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


# ── 텍스트 전처리 ──────────────────────────────────────────

_SPECIAL_CHAR_MAP = {
    '□': '• ', 'ㅇ': '• ', '※': '[주의] ',
    '▪': '• ', '▶': '• ', '◆': '• ',
    '◇': '• ', '●': '• ', '○': '• ',
}


def clean_text(text: str) -> str:
    if not text:
        return ""
    for char, repl in _SPECIAL_CHAR_MAP.items():
        text = text.replace(char, repl)
    text = text.replace('\t', ' ')
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    text = re.sub(r' {2,}', ' ', text)
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def clean_title(raw: str) -> str:
    if not raw:
        return raw
    raw = re.sub(r'^\[[\s]*일반공지[\s]*\]\s*', '', raw)
    raw = re.sub(r'\s*새글\s*$', '', raw)
    return ' '.join(raw.split()).strip()


# ── 크롤링 설정 ────────────────────────────────────────────

CUTOFF_DATE_STR = os.getenv("CUTOFF_DATE", "2025-12-01").strip()
PAGE_PARAM = os.getenv("PAGE_PARAM", "page").strip()
PAGE_START = int(os.getenv("PAGE_START", "1"))
MAX_PAGES = int(os.getenv("MAX_PAGES", "50"))
SLEEP_SEC = float(os.getenv("SLEEP_SEC", "0.5"))
CONTENT_MAX_CHARS = int(os.getenv("CONTENT_MAX_CHARS", "2000"))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": BASE_URL,
    "Cache-Control": "no-cache",
}

NOTICE_SELECTORS = [
    "td.tit a[href*='artclView']",
    "table.boardList tbody tr td.tit a",
    "table tbody tr td.tit a",
    "div.artclList a.artclLinkView",
    "div.boardList a.artclLinkView",
    "ul.board_list li a",
    "a.artclLinkView[href*='artclView']",
]

CONTENT_SELECTORS = [
    "div.artclView",
    "div.board_view",
    "div.content",
    "div.view_content",
    "div.artcl_content",
    ".artclView .artclContent",
    ".board_view .content",
]

DATE_RX = re.compile(r"(20\d{2})[.\-/년 ]\s?(\d{1,2})[.\-/월 ]\s?(\d{1,2})")

try:
    CUTOFF_DATE: date = datetime.strptime(CUTOFF_DATE_STR, "%Y-%m-%d").date()
except ValueError:
    CUTOFF_DATE = date(2025, 12, 1)


# ── 유틸리티 ───────────────────────────────────────────────

def sha1_url(url: str) -> str:
    return hashlib.sha1((url or "").encode("utf-8", errors="ignore")).hexdigest()


def normalize_date(text: str) -> Optional[str]:
    if not text:
        return None
    m = DATE_RX.search(text)
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


# ── 크롤링 핵심 로직 ──────────────────────────────────────

def parse_list(html: str, base_url: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    found = []
    for sel in NOTICE_SELECTORS:
        found = soup.select(sel)
        if found:
            break

    items = []
    for a in found:
        href = a.get("href")
        if not href or "artclView" not in href:
            continue
        detail_url = urljoin(base_url, href)
        row = a.find_parent("tr")
        ctx = row.get_text() if row else (a.parent.get_text() if a.parent else "")
        title = clean_title(a.get_text(strip=True))
        items.append({
            "title": title,
            "url": detail_url,
            "posted_date": normalize_date(ctx),
        })
    return items


def fetch_detail(session: requests.Session, url: str) -> Dict:
    r = session.get(url, timeout=20)
    if r.status_code != 200:
        return {"content_text": None}
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")

    content_text = None
    for sel in CONTENT_SELECTORS:
        elem = soup.select_one(sel)
        if elem:
            content_text = elem.get_text(separator="\n", strip=True)
            break
    content_text = (content_text or "")[:CONTENT_MAX_CHARS]
    return {"content_text": content_text}


def build_page_urls(list_url: str, max_pages: int) -> List[str]:
    abs_url = full_url(list_url)
    urls = []
    for p in range(PAGE_START, PAGE_START + max_pages):
        parts = urlparse(abs_url)
        q = parse_qs(parts.query)
        q[PAGE_PARAM] = [str(p)]
        new_url = urlunparse((
            parts.scheme, parts.netloc, parts.path,
            parts.params, urlencode(q, doseq=True), parts.fragment,
        ))
        urls.append(new_url)
    return urls


# ── DB UPSERT ──────────────────────────────────────────────

async def _upsert_notice(record: dict):
    """notices 테이블에 UPSERT. 성공 시 notice id 반환."""
    from core.database import AsyncSessionLocal
    from models.notice import Notice

    published_at = None
    if record.get("posted_date"):
        try:
            d = datetime.strptime(record["posted_date"][:10], "%Y-%m-%d")
            published_at = d.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        stmt = pg_insert(Notice).values(
            title=record["title"],
            content=clean_text(record.get("content_text") or ""),
            category=record["category"],
            source_url=record["url"],
            source_type="hs_notice",
            published_at=published_at,
            crawled_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["source_url"],
            set_={
                "title": stmt.excluded.title,
                "content": stmt.excluded.content,
                "crawled_at": now,
            },
        )
        stmt = stmt.returning(Notice.__table__.c.id)
        result = await session.execute(stmt)
        await session.commit()
        row = result.fetchone()
        return row[0] if row else None


# ── 카테고리별 크롤링 ─────────────────────────────────────

async def _crawl_category(
    cat: Category, http_session: requests.Session, seen_urls: set
) -> int:
    page_urls = build_page_urls(cat.list_url, MAX_PAGES)
    count = 0
    seen_first = None

    for idx, url in enumerate(page_urls, 1):
        logger.info(f"  [LIST] {cat.category_name} 페이지 {idx}")
        try:
            html = http_session.get(url, timeout=20).text
        except Exception as e:
            logger.warning(f"  [WARN] 목록 요청 실패: {e}")
            break

        items = parse_list(html, BASE_URL)
        if not items:
            break

        if seen_first == items[0]["url"]:
            break
        seen_first = items[0]["url"]

        for it in items:
            if it["url"] in seen_urls:
                continue
            seen_urls.add(it["url"])

            d = _parse_date(it.get("posted_date"))
            if d and d < CUTOFF_DATE:
                return count

            detail = fetch_detail(http_session, it["url"])
            record = {
                **it,
                **detail,
                "category": cat.category_code,
            }

            notice_id = await _upsert_notice(record)
            count += 1

            if notice_id:
                try:
                    from ai.embeddings import embed_notice
                    text = f"{record['title']} {record.get('content_text', '')}"
                    await embed_notice(notice_id, text)
                except Exception as e:
                    logger.warning(f"    [EMBED] 임베딩 실패 (계속 진행): {e}")

                try:
                    from ai.summarize import summarize_notice
                    from sqlalchemy import update as sa_update
                    from models.notice import Notice
                    from core.database import AsyncSessionLocal
                    summary = await summarize_notice(
                        record["title"],
                        record.get("content_text") or "",
                    )
                    if summary:
                        async with AsyncSessionLocal() as sess:
                            await sess.execute(
                                sa_update(Notice)
                                .where(Notice.id == notice_id)
                                .values(summary=summary)
                            )
                            await sess.commit()
                except Exception as e:
                    logger.warning(f"    [SUMMARY] 요약 생성 실패 (계속 진행): {e}")

            logger.info(f"    [DETAIL] {it['title'][:50]}...")
            time.sleep(SLEEP_SEC)

    return count


# ── 메인 실행 ──────────────────────────────────────────────

async def run_crawl_job() -> None:
    logger.info(f"[CUTOFF] {CUTOFF_DATE} 이후 공지만 수집")
    seen_urls: set[str] = set()
    total = 0

    http_session = requests.Session()
    http_session.headers.update(HEADERS)

    try:
        for cat in CATEGORIES:
            logger.info(f"\n=== [{cat.category_name}] ===")
            try:
                count = await _crawl_category(cat, http_session, seen_urls)
                total += count
                logger.info(f"  -> {count}건 수집/업데이트")
            except Exception as e:
                logger.error(f"  [ERROR] {cat.category_name} 실패: {e}")
    finally:
        http_session.close()

    logger.info(f"\n[DONE] 총 {total}건 처리 완료")
