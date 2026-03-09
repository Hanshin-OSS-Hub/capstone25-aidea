# -*- coding: utf-8 -*-
"""
월별+카테고리별 JSON 저장.
- 확장자 .json, 내용은 JSON 배열 (표준 JSON 파서 호환)
- 게시일 기준으로 YYYYMM_카테고리명.json 라우팅
- manifest.json, uid 기반 중복 방지
"""
import hashlib
import json
import re
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Set

# 2025-12-01 이후만 수집
CUTOFF_DATE = date(2025, 12, 1)

DATA_DIR = Path(__file__).parent / "data" / "notices"
MANIFEST_FILE = DATA_DIR / "manifest.json"
UIDS_FILE = DATA_DIR / "processed_uids.json"


def _safe_filename_part(name: str) -> str:
    """파일명에 사용할 카테고리명 (· 등 제거)"""
    return re.sub(r"[·\s]+", "", name) or name


def _month_key(d: date) -> str:
    """게시일 → YYYYMM"""
    return d.strftime("%Y%m")


def _target_filename(posted_date: date, category_name: str) -> str:
    """게시일+카테고리 → 파일명 (확장자 .json)"""
    yyyymm = _month_key(posted_date)
    safe_cat = _safe_filename_part(category_name)
    return f"{yyyymm}_{safe_cat}.json"


def _ensure_data_dir() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR


def load_processed_uids() -> Set[str]:
    """처리 완료 uid 로드"""
    if not UIDS_FILE.exists():
        return set()
    try:
        data = json.loads(UIDS_FILE.read_text(encoding="utf-8"))
        return set(data.get("uids", []))
    except Exception:
        return set()


def save_processed_uids(uids: Set[str]) -> None:
    """처리 완료 uid 저장"""
    _ensure_data_dir()
    UIDS_FILE.write_text(
        json.dumps(
            {"uids": list(uids), "updated": datetime.now().isoformat()},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def load_manifest() -> Dict:
    """manifest.json 로드"""
    if not MANIFEST_FILE.exists():
        return {"last_updated": None, "cutoff_date": str(CUTOFF_DATE), "files": {}}
    try:
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"last_updated": None, "cutoff_date": str(CUTOFF_DATE), "files": {}}


def save_manifest(manifest: Dict) -> None:
    """manifest.json 저장"""
    _ensure_data_dir()
    manifest["last_updated"] = datetime.now().isoformat()
    manifest["cutoff_date"] = str(CUTOFF_DATE)
    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def to_notice_record(record: Dict, category_name: str) -> Dict:
    """저장용 공지 객체 (uid 포함, RAG 편의)"""
    uid = record.get("uid") or record.get("_uid")
    url = record.get("url", "")
    if not uid:
        uid = hashlib.sha1(url.encode("utf-8", errors="ignore")).hexdigest()

    return {
        "uid": uid,
        "source": record.get("source", ""),
        "category": record.get("category", ""),
        "category_name": category_name,
        "title": record.get("title", ""),
        "url": url,
        "posted_date": record.get("posted_date"),
        "content_text": record.get("content_text") or "",
        "content_hash": record.get("content_hash") or "",
        "attachments": record.get("attachments", []),
        "images": record.get("images", []),
        "crawled_at": record.get("crawled_at", ""),
    }


def _load_notices_array(path: Path) -> List[Dict]:
    """파일에서 공지 배열 로드 (JSON 배열 또는 NDJSON 호환)"""
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    # NDJSON 형식(기존 파일) 변환
    items = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return items


def append_notice(record: Dict, category_name: str) -> bool:
    """
    공지 1건을 게시일 기준 파일에 JSON 배열로 append.
    Returns: True if appended, False if skipped (e.g. no valid posted_date)
    """
    posted = record.get("posted_date")
    if not posted:
        return False
    d = _parse_date(posted)
    if not d or d < CUTOFF_DATE:
        return False

    _ensure_data_dir()
    fname = _target_filename(d, category_name)
    path = DATA_DIR / fname

    obj = to_notice_record(record, category_name)
    items = _load_notices_array(path)
    items.append(obj)

    path.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # manifest 갱신
    manifest = load_manifest()
    if "files" not in manifest:
        manifest["files"] = {}
    if fname not in manifest["files"]:
        manifest["files"][fname] = {"count": 0, "last_posted_date": None, "last_uid": None}
    mf = manifest["files"][fname]
    mf["count"] = mf.get("count", 0) + 1
    mf["last_posted_date"] = str(d)
    mf["last_uid"] = obj["uid"]
    save_manifest(manifest)

    return True


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def save_notices(notices: List[Dict], category_name: str) -> Dict[str, int]:
    """
    공지 목록을 게시일 기준 월별 파일에 append.
    Returns: { "saved": N, "skipped": M }
    """
    saved = 0
    skipped = 0
    for rec in notices:
        if append_notice(rec, category_name):
            saved += 1
        else:
            skipped += 1
    return {"saved": saved, "skipped": skipped}
