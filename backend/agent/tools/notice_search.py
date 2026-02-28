"""
공지사항 검색 도구: DB에서 공지사항 검색
역할: PostgreSQL DB에서 공지사항을 검색합니다.
ReAct Agent가 호출할 수 있는 LangChain Tool로 구현됨.
"""

from langchain_core.tools import tool
from typing import Optional
import sys
import os

# 경로 설정
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.database import SessionLocal
from backend.models import Notice, NoticeAIField
from sqlalchemy import or_, and_, desc


def _format_notice_results(notices, max_results=5):
    """
    검색된 공지사항을 포맷합니다.
    
    Args:
        notices: Notice 객체 리스트
        max_results: 최대 결과 개수
        
    Returns:
        str: 포맷된 공지사항 정보
    """
    if not notices:
        return "검색된 공지사항이 없습니다."
    
    result_lines = []
    result_lines.append(f"총 {len(notices)}개의 공지사항을 찾았습니다.\n")
    
    for i, notice in enumerate(notices[:max_results], 1):
        result_lines.append(f"[{i}] {notice.title}")
        result_lines.append(f"   카테고리: {notice.category_name or notice.category}")
        
        # AI 분석 결과가 있으면 요약 포함
        if notice.ai_field and notice.ai_field.status == "success":
            if notice.ai_field.summary:
                summary = " ".join(notice.ai_field.summary[:2])  # 처음 2줄만
                result_lines.append(f"   요약: {summary}")
            
            if notice.ai_field.start_date or notice.ai_field.end_date:
                date_info = []
                if notice.ai_field.start_date:
                    date_info.append(f"시작: {notice.ai_field.start_date}")
                if notice.ai_field.end_date:
                    date_info.append(f"마감: {notice.ai_field.end_date}")
                result_lines.append(f"   일정: {', '.join(date_info)}")
        
        # 원본 URL
        if notice.original_url:
            result_lines.append(f"   링크: {notice.original_url}")
        
        result_lines.append("")  # 빈 줄
    
    if len(notices) > max_results:
        result_lines.append(f"(더 많은 결과가 있습니다. 총 {len(notices)}개)")
    
    return "\n".join(result_lines)


@tool
def search_notices(query: str, category: Optional[str] = None) -> str:
    """
    한신대학교 공지사항을 검색합니다.
    
    DB에서 공지사항 제목, 내용, AI 요약을 검색하여 관련된 공지사항을 찾아줍니다.
    검색 결과에는 제목, 카테고리, 요약, 일정, 링크가 포함됩니다.
    
    사용 시점:
    - 사용자가 최근 공지사항이나 학교 일정을 물어볼 때
    - 장학금, 학사, 행사 등의 공지를 찾을 때
    - "공지", "안내", "모집", "신청" 등의 키워드가 포함될 때
    
    Args:
        query (str): 검색할 키워드 (예: "장학금", "모집", "AI 대회", "신청")
        category (str, optional): 카테고리 필터 ("scholarship", "academic", "event", "career")
        
    Returns:
        str: 검색된 공지사항 정보 (제목, 요약, 일정, 링크 포함)
    
    예시:
        search_notices("장학금 신청")
        search_notices("AI 대회", category="event")
        search_notices("학점 취득")
    """
    db = SessionLocal()
    
    try:
        # 기본 쿼리
        query_obj = db.query(Notice).outerjoin(NoticeAIField)
        
        # 카테고리 필터
        if category:
            query_obj = query_obj.filter(Notice.category == category)
        
        # 키워드 검색 (여러 키워드 OR - "근로장학 2026" → 근로장학 OR 2026 포함 공지)
        keywords = [k.strip() for k in query.split() if len(k.strip()) >= 2]
        if not keywords:
            keywords = [query]
        conds = []
        for kw in keywords[:5]:
            term = f"%{kw}%"
            conds.append(Notice.title.ilike(term))
            conds.append(Notice.content.ilike(term))
        query_obj = query_obj.filter(or_(*conds))
        
        # 최신순 정렬
        query_obj = query_obj.order_by(desc(Notice.posted_date))
        
        # 최대 10개만 조회
        notices = query_obj.limit(10).all()
        
        # 결과 포맷
        result = _format_notice_results(notices, max_results=5)
        
        return result
        
    except Exception as e:
        return f"공지사항 검색 중 오류가 발생했습니다: {str(e)}"
    finally:
        db.close()


@tool
def get_recent_notices(category: Optional[str] = None, limit: int = 5) -> str:
    """
    최근 공지사항을 조회합니다.
    
    사용자가 "최근 공지", "최신 공지", "최근에 올라온 공지" 등을 물어볼 때 사용합니다.
    
    Args:
        category (str, optional): 카테고리 필터 ("scholarship", "academic", "event", "career")
        limit (int): 조회할 개수 (기본 5개)
        
    Returns:
        str: 최근 공지사항 정보
    
    예시:
        get_recent_notices()
        get_recent_notices(category="scholarship", limit=3)
    """
    db = SessionLocal()
    
    try:
        # 기본 쿼리
        query_obj = db.query(Notice).outerjoin(NoticeAIField)
        
        # 카테고리 필터
        if category:
            query_obj = query_obj.filter(Notice.category == category)
        
        # 최신순 정렬
        query_obj = query_obj.order_by(desc(Notice.posted_date))
        
        # 조회
        notices = query_obj.limit(limit).all()
        
        # 결과 포맷
        result = _format_notice_results(notices, max_results=limit)
        
        return result
        
    except Exception as e:
        return f"최근 공지사항 조회 중 오류가 발생했습니다: {str(e)}"
    finally:
        db.close()


@tool
def search_notices_by_deadline(days_ahead: int = 7) -> str:
    """
    마감일이 임박한 공지사항을 조회합니다.
    
    사용자가 "마감 임박", "급한 공지", "D-day" 등을 물어볼 때 사용합니다.
    
    Args:
        days_ahead (int): 앞으로 며칠 이내의 마감일 (기본 7일)
        
    Returns:
        str: 마감일이 임박한 공지사항 정보
    
    예시:
        search_notices_by_deadline()  # 7일 이내
        search_notices_by_deadline(days_ahead=3)  # 3일 이내
    """
    from datetime import date, timedelta
    
    db = SessionLocal()
    
    try:
        # 기준 날짜 계산
        today = date.today()
        future_date = today + timedelta(days=days_ahead)
        
        # 쿼리: end_date가 오늘~미래일 사이
        query_obj = db.query(Notice).join(NoticeAIField).filter(
            and_(
                NoticeAIField.end_date.isnot(None),
                NoticeAIField.end_date >= today,
                NoticeAIField.end_date <= future_date,
                NoticeAIField.status == "success"
            )
        )
        
        # 마감일 가까운 순으로 정렬
        query_obj = query_obj.order_by(NoticeAIField.end_date)
        
        # 조회
        notices = query_obj.limit(10).all()
        
        if not notices:
            return f"앞으로 {days_ahead}일 이내에 마감되는 공지사항이 없습니다."
        
        # 결과 포맷
        result = _format_notice_results(notices, max_results=5)
        
        return result
        
    except Exception as e:
        return f"마감 임박 공지사항 조회 중 오류가 발생했습니다: {str(e)}"
    finally:
        db.close()
