# -*- coding: utf-8 -*-
"""
카테고리별 크롤링 설정.
- 카테고리 추가 = CATEGORIES에 한 줄 추가.
"""
from typing import NamedTuple

BASE_URL = "https://www.hs.ac.kr"


class Category(NamedTuple):
    """카테고리 설정"""
    category_code: str   # DB 저장용
    category_name: str   # 사람이 보는 이름
    list_url: str        # /kor/{menu_id}/subview.do 형태 (상대경로)
    menu_id: str = ""    # 로그/디버깅용 (선택)


def full_url(path: str) -> str:
    """상대경로를 절대 URL로 변환"""
    path = path.strip()
    if path.startswith("http"):
        return path
    base = BASE_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


# =============================================================================
# CATEGORIES: 수동 설정 방식 (크롬에서 각 메뉴 눌러서 URL 복사 후 입력)
# =============================================================================
CATEGORIES = [
    Category(
        category_code="notice",
        category_name="공지사항",
        list_url="/kor/4953/subview.do",
        menu_id="4953",
    ),
    Category(
        category_code="event",
        category_name="행사공지",
        list_url="/kor/4955/subview.do",
        menu_id="4955",
    ),
    Category(
        category_code="academic",
        category_name="학사공지",
        list_url="/kor/4956/subview.do",
        menu_id="4956",
    ),
    Category(
        category_code="scholarship",
        category_name="장학·사회봉사",
        list_url="/kor/4957/subview.do",
        menu_id="4957",
    ),
    Category(
        category_code="employment",
        category_name="취업공지",
        list_url="/kor/4958/subview.do",
        menu_id="4958",
    ),
    # 개인정보공지: 메뉴에서 URL 확인 후 menu_id/list_url 수정
    Category(
        category_code="privacy",
        category_name="개인정보공지",
        list_url="/kor/4959/subview.do",  # TODO: 실제 URL로 수정
        menu_id="4959",
    ),
]
