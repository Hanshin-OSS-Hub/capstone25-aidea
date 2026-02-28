# crawler.py
import os

# Updated import paths
from crawler_app.config.settings import *
import re
import io
import csv
import json
import time
import hashlib
import platform
import shutil
from datetime import datetime, date
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

import requests
from bs4 import BeautifulSoup

import PyPDF2
from docx import Document
import openpyxl
from pptx import Presentation

from PIL import Image, ImageOps
import pytesseract
from dotenv import load_dotenv

# =========================
# 0) ENV 로딩
# =========================
load_dotenv()

# =========================
# 1) 설정
# =========================
TARGET_URL = os.getenv(
    "TARGET_URL",
    "https://www.hs.ac.kr/kor/4953/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa29yJTJGMjQlMkZhcnRjbExpc3QuZG8lM0Y%3D"
)
BASE_URL = os.getenv("BASE_URL", "https://www.hs.ac.kr")
NOTICE_SOURCE = os.getenv("NOTICE_SOURCE", "hs_notice")

# Backfill
BACKFILL_MODE = os.getenv("BACKFILL_MODE", "0") == "1"
BACKFILL_CUTOFF_DATE = (os.getenv("BACKFILL_CUTOFF_DATE") or "").strip()

# Pagination
PAGE_PARAM = os.getenv("PAGE_PARAM", "page").strip()
PAGE_START = int(os.getenv("PAGE_START", "1"))
MAX_PAGES = int(os.getenv("MAX_PAGES", "1"))

# Options
SLEEP_SEC = float(os.getenv("SLEEP_SEC", "0.5"))
USE_SELENIUM_FALLBACK = os.getenv("USE_SELENIUM_FALLBACK", "1") == "1"

FETCH_DETAIL = os.getenv("FETCH_DETAIL", "1") == "1"
FETCH_ATTACH_TEXT = os.getenv("FETCH_ATTACH_TEXT", "0") == "1"
FETCH_IMAGE_OCR = os.getenv("FETCH_IMAGE_OCR", "1") == "1"

# OCR
TESSERACT_CMD = (os.getenv("TESSERACT_CMD") or "").strip()
OCR_LANG = os.getenv("OCR_LANG", "kor+eng")
USE_OCR_PREPROCESS = os.getenv("USE_OCR_PREPROCESS", "1") == "1"
OCR_MAX_CHARS = int(os.getenv("OCR_MAX_CHARS", "500"))

CONTENT_MAX_CHARS = int(os.getenv("CONTENT_MAX_CHARS", "2000"))
ATTACH_MAX_CHARS = int(os.getenv("ATTACH_MAX_CHARS", "1000"))

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
    "div.artclList a.artclLinkView",
    "div.boardList a.artclLinkView",
    "table.boardList tbody tr td.tit a",
    "ul.board_list li a",
    "a.artclLinkView",
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

# =========================
# 2) 유틸
# =========================
def sha256_text(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8", errors="ignore")).hexdigest()

def normalize_space(s: str) -> str:
    return " ".join((s or "").split())

def normalize_date(text: str) -> Optional[str]:
    if not text:
        return None
    m = DATE_RX.search(text)
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"

def parse_ymd(d: Optional[str]) -> Optional[date]:
    if not d:
        return None
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except:
        return None

CUTOFF_DATE: Optional[date] = parse_ymd(BACKFILL_CUTOFF_DATE) if BACKFILL_MODE else None

def ensure_tesseract_ready():
    if TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

    if platform.system() != "Windows":
        if shutil.which("tesseract") is None and not TESSERACT_CMD:
            raise RuntimeError("tesseract not found")

# =========================
# 3) 상세 크롤링
# =========================
def fetch_detail(session: requests.Session, url: str) -> Dict:
    r = session.get(url, timeout=20)
    if r.status_code != 200:
        return {"content_text": None, "attachments": [], "images": []}

    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")

    content_text = None
    for sel in CONTENT_SELECTORS:
        elem = soup.select_one(sel)
        if elem:
            content_text = elem.get_text(separator="\n", strip=True)
            break

    return {
        "content_text": (content_text or "")[:CONTENT_MAX_CHARS],
        "content_hash": sha256_text(content_text),
        "attachments": [],
        "images": [],
    }

# =========================
# 4) 목록 크롤링
# =========================
def parse_list(html: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    found = []

    for sel in NOTICE_SELECTORS:
        found = soup.select(sel)
        if found:
            break

    items = []
    for a in found:
        items.append({
            "title": a.get_text(strip=True),
            "url": urljoin(BASE_URL, a.get("href")),
            "posted_date": normalize_date(a.parent.get_text()),
            "category": None,
        })
    return items

def build_page_urls(first_url: str, max_pages: int) -> List[str]:
    urls = []
    for p in range(PAGE_START, PAGE_START + max_pages):
        urls.append(
            add_or_replace_query_param(first_url, PAGE_PARAM, str(p))
        )
    return urls

def add_or_replace_query_param(url: str, key: str, value: str) -> str:
    parts = urlparse(url)
    q = parse_qs(parts.query)
    q[key] = [value]
    return urlunparse((parts.scheme, parts.netloc, parts.path, parts.params, urlencode(q, doseq=True), parts.fragment))

def crawl_list_items() -> List[Dict]:
    ensure_tesseract_ready()
    urls = build_page_urls(TARGET_URL, MAX_PAGES)
    all_items = []
    seen_first = None

    with requests.Session() as session:
        session.headers.update(HEADERS)

        for idx, url in enumerate(urls, 1):
            print(f"=== LIST PAGE {idx} ===")
            html = session.get(url).text
            items = parse_list(html)
            if not items:
                break

            if seen_first == items[0]["url"]:
                print("[STOP] 페이지가 이동하지 않아 중단")
                break
            seen_first = items[0]["url"]

            for it in items:
                d = parse_ymd(it["posted_date"])
                if CUTOFF_DATE and d and d < CUTOFF_DATE:
                    return all_items
                all_items.append(it)

    return all_items

def crawl_details(list_items: List[Dict]) -> List[Dict]:
    results = []
    with requests.Session() as session:
        session.headers.update(HEADERS)

        for it in list_items:
            print(f"[DETAIL] {it['title'][:50]}...")
            detail = fetch_detail(session, it["url"])
            results.append({
                **it,
                **detail,
                "source": NOTICE_SOURCE,
                "crawled_at": datetime.now().isoformat(timespec="seconds"),
            })
            time.sleep(SLEEP_SEC)
    return results

# =========================
# 5) DB 저장
# =========================
def save_to_db(notices: List[Dict]):
    import storage_pg
    result = storage_pg.save_notices(notices)
    print("[DB] saved:", result)

# =========================
# 6) 실행
# =========================
def run_job():
    items = crawl_list_items()
    notices = crawl_details(items)
    print(f"[DONE] {len(notices)} notices")

    if os.getenv("SAVE_DB", "0") == "1":
        save_to_db(notices)

if __name__ == "__main__":
    run_job()
