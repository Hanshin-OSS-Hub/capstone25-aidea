# crawler.py
"""
다중 카테고리 크롤링 엔진.
- 카테고리별 list_url만 바꿔서 같은 로직 재사용.
- for cat in CATEGORIES: crawl_category(cat)
"""
import os
import re
import time
import hashlib
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from categories import CATEGORIES, Category, full_url
from storage_json import (
    append_notice,
    load_processed_uids,
    save_processed_uids,
)

# =========================
# 0) ENV 로딩
# =========================
load_dotenv()

# =========================
# 1) 설정
# =========================
BASE_URL = os.getenv("BASE_URL", "https://www.hs.ac.kr")
NOTICE_SOURCE = os.getenv("NOTICE_SOURCE", "hs_notice")

# 2025-12-01 이후 공지만 수집 (env로 변경 가능)
CUTOFF_DATE_STR = (os.getenv("CUTOFF_DATE") or os.getenv("BACKFILL_CUTOFF_DATE") or "2025-12-01").strip()

# Pagination
PAGE_PARAM = (os.getenv("PAGE_PARAM") or "page").strip()
PAGE_START = int(os.getenv("PAGE_START", "1"))
MAX_PAGES = int(os.getenv("MAX_PAGES", "50"))  # 2025-12-01 도달까지 충분히

# Options
SLEEP_SEC = float(os.getenv("SLEEP_SEC", "0.5"))
CONTENT_MAX_CHARS = int(os.getenv("CONTENT_MAX_CHARS", "2000"))

# JSON 저장: data/notices/ (storage_json에서 관리)

USER_AGENT = os.getenv(
    "USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": BASE_URL,
    "Cache-Control": "no-cache",
}

NOTICE_SELECTORS = [
    "td.tit a[href*='artclView']",      # 제목 컬럼의 상세 링크 (우선)
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

CUTOFF_DATE: date
try:
    CUTOFF_DATE = datetime.strptime(CUTOFF_DATE_STR, "%Y-%m-%d").date()
except ValueError:
    CUTOFF_DATE = date(2025, 12, 1)

# =========================
# 2) 유틸
# =========================
def sha1_url(url: str) -> str:
    """중복 체크용 unique_key"""
    return hashlib.sha1((url or "").encode("utf-8", errors="ignore")).hexdigest()


def sha256_text(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8", errors="ignore")).hexdigest()


def normalize_date(text: str) -> Optional[str]:
    if not text:
        return None
    m = DATE_RX.search(text)
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def _safe_print(s: str) -> None:
    """Windows cp949 콘솔 인코딩 오류 방지"""
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("ascii", errors="replace").decode("ascii"))


def parse_ymd(d: Optional[str]) -> Optional[date]:
    if not d:
        return None
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except ValueError:
        return None




# =========================
# 3) parse_list / parse_detail
# =========================
def parse_list(html: str, base_url: str) -> List[Dict]:
    """목록 HTML에서 (title, detail_url, date) 추출"""
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
        title = _clean_title(a.get_text(strip=True))
        items.append({
            "title": title,
            "url": detail_url,
            "posted_date": normalize_date(ctx),
            "category": None,  # crawl_category에서 주입
        })
    return items


def _clean_title(raw: str) -> str:
    """제목에서 [ 일반공지 ], 새글 등 접두/접미어 정리"""
    if not raw:
        return raw
    raw = re.sub(r"^\[[\s]*일반공지[\s]*\]\s*", "", raw)
    raw = re.sub(r"\s*새글\s*$", "", raw)
    return " ".join(raw.split()).strip()


def fetch_detail(session: requests.Session, url: str) -> Dict:
    """상세 페이지에서 본문/첨부 추출"""
    r = session.get(url, timeout=20)
    if r.status_code != 200:
        return {"content_text": None, "content_hash": None, "attachments": [], "images": []}

    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")

    content_text = None
    for sel in CONTENT_SELECTORS:
        elem = soup.select_one(sel)
        if elem:
            content_text = elem.get_text(separator="\n", strip=True)
            break

    content_text = (content_text or "")[:CONTENT_MAX_CHARS]
    return {
        "content_text": content_text,
        "content_hash": sha256_text(content_text),
        "attachments": [],
        "images": [],
    }


# =========================
# 4) crawl_category (공통 로직)
# =========================
def build_page_urls(list_url: str, max_pages: int) -> List[str]:
    """페이지네이션 URL 생성"""
    abs_url = full_url(list_url)
    urls = []
    for p in range(PAGE_START, PAGE_START + max_pages):
        urls.append(add_or_replace_query_param(abs_url, PAGE_PARAM, str(p)))
    return urls


def add_or_replace_query_param(url: str, key: str, value: str) -> str:
    parts = urlparse(url)
    q = parse_qs(parts.query)
    q[key] = [value]
    return urlunparse((parts.scheme, parts.netloc, parts.path, parts.params, urlencode(q, doseq=True), parts.fragment))


def crawl_category(cat: Category, processed: Set[str], session: requests.Session) -> List[Dict]:
    """
    카테고리별 크롤링 공통 로직.
    - cat.list_url로 목록 HTML 요청
    - parse_list로 (title, detail_url, date) 추출
    - 중복 체크(processed) 후 상세 요청
    - parse_detail로 본문 추출
    - record["category"] = cat.category_code 주입
    """
    list_url = full_url(cat.list_url)
    page_urls = build_page_urls(cat.list_url, MAX_PAGES)
    all_records = []
    seen_first = None

    for idx, url in enumerate(page_urls, 1):
        print(f"  [LIST] {cat.category_name} 페이지 {idx}")
        try:
            html = session.get(url, timeout=20).text
        except Exception as e:
            print(f"  [WARN] 목록 요청 실패: {e}")
            break

        items = parse_list(html, BASE_URL)
        if not items:
            break

        if seen_first == items[0]["url"]:
            print("  [STOP] 페이지 이동 없음, 다음 카테고리로")
            break
        seen_first = items[0]["url"]

        for it in items:
            detail_url = it["url"]
            unique_key = sha1_url(detail_url)

            # 중복 체크: 이미 처리된 URL 스킵
            if unique_key in processed:
                continue

            d = parse_ymd(it.get("posted_date"))
            # 2025-12-01 이전 게시 → 최신순이므로 이 카테고리 종료
            if d and d < CUTOFF_DATE:
                return all_records

            # 상세 요청
            detail = fetch_detail(session, detail_url)
            record = {
                **it,
                **detail,
                "uid": unique_key,
                "category": cat.category_code,
                "source": NOTICE_SOURCE,
                "crawled_at": datetime.now().isoformat(timespec="seconds"),
            }
            all_records.append(record)
            processed.add(unique_key)

            # 게시일 기준 월별 JSON 파일에 NDJSON append (.json 확장자)
            append_notice(record, cat.category_name)

            _safe_print(f"    [DETAIL] {it['title'][:50]}...")
            time.sleep(SLEEP_SEC)

    return all_records


# =========================
# 5) DB 저장
# =========================
def save_to_db(notices: List[Dict]) -> None:
    try:
        import storage_pg
        result = storage_pg.save_notices(notices)
        print("[DB] saved:", result)
    except Exception as e:
        print("[DB] 저장 실패 (PostgreSQL 확인):", e)


# =========================
# 6) 메인 루프
# =========================
def run_job() -> None:
    """CATEGORIES를 순회하며 각 카테고리 크롤링 (2025-12-01 이후만)"""
    processed = load_processed_uids()
    all_notices = []

    print(f"[CUTOFF] {CUTOFF_DATE} 이후 공지만 수집")

    with requests.Session() as session:
        session.headers.update(HEADERS)

        for cat in CATEGORIES:
            print(f"\n=== [{cat.category_name}] (menu_id={cat.menu_id or '?'}) ===")
            try:
                records = crawl_category(cat, processed, session)
                all_notices.extend(records)
                print(f"  -> {len(records)}건 수집 (data/notices/ YYYYMM_카테고리.json)")
            except Exception as e:
                print(f"  [ERROR] {cat.category_name} 실패: {e}")

    save_processed_uids(processed)
    print(f"\n[DONE] 총 {len(all_notices)} notices → data/notices/")

    if os.getenv("SAVE_DB", "0") == "1":
        save_to_db(all_notices)


if __name__ == "__main__":
    run_job()
