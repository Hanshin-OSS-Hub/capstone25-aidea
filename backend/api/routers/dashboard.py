"""
대시보드 API 라우터
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from backend.database import get_db
from backend.services.notice_service import NoticeService
from backend.api.responses import success_response
from backend.api.exceptions import InternalError
from backend.models import CalendarEvent
from datetime import datetime

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/favorites")
async def get_dashboard_favorites(
    user_id: int = Query(1, description="사용자 ID"),
    limit: int = Query(5, ge=1, le=100, description="개수 제한"),
    sort: str = Query("deadline", description="정렬 (deadline/latest)"),
    db: Session = Depends(get_db)
):
    """
    대시보드용 관심 공지 Top N
    
    GET /api/v1/dashboard/favorites?user_id=1&limit=5&sort=deadline
    
    Response:
        공지 카드 리스트 (notice_id, title, category, end_date, d_day, ai_summary_3lines, original_url, has_attachment)
    """
    try:
        result = NoticeService.get_dashboard_favorites(
            db=db,
            user_id=user_id,
            limit=limit,
            sort=sort
        )
        
        return success_response({"items": result})
        
    except Exception as e:
        raise InternalError(f"대시보드 관심 공지 조회 실패: {str(e)}")


@router.get("/upcoming-events")
async def get_upcoming_events(
    user_id: int = Query(1, description="사용자 ID"),
    limit: int = Query(5, ge=1, le=10, description="개수 제한"),
    db: Session = Depends(get_db)
):
    """
    대시보드용 다가오는 일정 Top N
    
    GET /api/v1/dashboard/upcoming-events?user_id=1&limit=5
    
    Response:
        일정 리스트 (event_id, title, start_at, end_at, source, notice_id, d_day)
    """
    try:
        # 사용자의 일정 가져오기 (시작일 기준 정렬)
        events = db.query(CalendarEvent).filter(
            CalendarEvent.user_id == user_id
        ).filter(
            CalendarEvent.start_at >= datetime.now()
        ).order_by(CalendarEvent.start_at).limit(limit).all()
        
        # 응답 데이터 구성
        items = []
        for event in events:
            # D-day 계산
            d_day = (event.start_at.date() - datetime.now().date()).days
            
            item = {
                "event_id": event.event_id,
                "title": event.title,
                "start_at": event.start_at.isoformat(),
                "end_at": event.end_at.isoformat(),
                "source": event.source,
                "notice_id": event.notice_id,
                "d_day": d_day
            }
            items.append(item)
        
        return success_response({"items": items})
        
    except Exception as e:
        raise InternalError(f"다가오는 일정 조회 실패: {str(e)}")
