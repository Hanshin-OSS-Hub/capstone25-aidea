"""
캘린더 API 라우터
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from backend.database import get_db
from backend.services.calendar_service import CalendarService
from backend.api.responses import success_response
from backend.api.exceptions import ValidationError, InternalError
from backend.models.user import User
from backend.api.routers.auth import get_current_user

router = APIRouter(prefix="/calendar", tags=["Calendar"])


class CreateEventRequest(BaseModel):
    """일정 생성 요청"""
    title: str
    start_at: str  # ISO 8601 형식 (예: "2026-02-14T09:00:00")
    end_at: str
    memo: Optional[str] = None


class UpdateEventRequest(BaseModel):
    """일정 수정 요청"""
    title: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    memo: Optional[str] = None


class CreateEventFromNoticeRequest(BaseModel):
    """공지사항에서 일정 생성 요청"""
    notice_id: int


@router.post("")
async def create_event(
    request: CreateEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    일정 생성
    
    POST /api/v1/calendar
    Body: {
        "user_id": 1,
        "title": "중간고사",
        "start_at": "2026-04-15T09:00:00",
        "end_at": "2026-04-19T18:00:00",
        "memo": "시험 준비 열심히"
    }
    
    Response:
        201: {"success": true, "data": {...}, "error": null}
    """
    try:
        # 날짜 파싱
        start_at = datetime.fromisoformat(request.start_at)
        end_at = datetime.fromisoformat(request.end_at)
        
        # 날짜 검증
        if start_at >= end_at:
            raise ValidationError("start_at must be before end_at")
        
        result = CalendarService.create_event(
            db=db,
            user_id=current_user.user_id,
            title=request.title,
            start_at=start_at,
            end_at=end_at,
            memo=request.memo,
            source="manual"
        )
        
        return success_response(result)
        
    except ValueError as e:
        raise ValidationError(f"Invalid datetime format: {str(e)}")
    except ValidationError:
        raise
    except Exception as e:
        raise InternalError(f"일정 생성 실패: {str(e)}")


@router.get("")
async def get_events(
    year: Optional[int] = Query(None, description="연도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="월"),
    day: Optional[int] = Query(None, ge=1, le=31, description="일"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    일정 조회 (월별, 날짜별)
    
    GET /api/v1/calendar?user_id=1&year=2026&month=2
    GET /api/v1/calendar?user_id=1&year=2026&month=2&day=14
    
    Response:
        200: {"success": true, "data": {"items": [...]}, "error": null}
    """
    try:
        result = CalendarService.get_events(
            db=db,
            user_id=current_user.user_id,
            year=year,
            month=month,
            day=day
        )
        
        return success_response({"items": result})
        
    except Exception as e:
        raise InternalError(f"일정 조회 실패: {str(e)}")


@router.get("/{event_id}")
async def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    일정 상세 조회
    
    GET /api/v1/calendar/{event_id}?user_id=1
    
    Response:
        200: {"success": true, "data": {...}, "error": null}
        404: 일정 없음
    """
    try:
        result = CalendarService.get_event_by_id(
            db=db,
            event_id=event_id,
            user_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
        
        return success_response(result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"일정 상세 조회 실패: {str(e)}")


@router.put("/{event_id}")
async def update_event(
    event_id: int,
    request: UpdateEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    일정 수정
    
    PUT /api/v1/calendar/{event_id}?user_id=1
    Body: {
        "title": "기말고사",
        "start_at": "2026-06-15T09:00:00",
        "end_at": "2026-06-19T18:00:00",
        "memo": "시험 범위 확인"
    }
    
    Response:
        200: {"success": true, "data": {...}, "error": null}
        404: 일정 없음
    """
    try:
        # 날짜 파싱
        start_at = datetime.fromisoformat(request.start_at) if request.start_at else None
        end_at = datetime.fromisoformat(request.end_at) if request.end_at else None
        
        result = CalendarService.update_event(
            db=db,
            event_id=event_id,
            user_id=current_user.user_id,
            title=request.title,
            start_at=start_at,
            end_at=end_at,
            memo=request.memo
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
        
        return success_response(result)
        
    except ValueError as e:
        raise ValidationError(f"Invalid datetime format: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"일정 수정 실패: {str(e)}")


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    일정 삭제
    
    DELETE /api/v1/calendar/{event_id}?user_id=1
    
    Response:
        200: {"success": true, "data": {"deleted": true}, "error": null}
        404: 일정 없음
    """
    try:
        deleted = CalendarService.delete_event(
            db=db,
            event_id=event_id,
            user_id=current_user.user_id
        )
        
        if not deleted:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
        
        return success_response({"deleted": True})
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"일정 삭제 실패: {str(e)}")


@router.post("/from-notice")
async def create_event_from_notice(
    request: CreateEventFromNoticeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    공지사항에서 일정 자동 생성
    
    POST /api/v1/calendar/from-notice
    Body: {"user_id": 1, "notice_id": 22}
    
    Response:
        201: {"success": true, "data": {...}, "error": null}
        404: 공지사항 없음 or AI 분석 실패
    """
    try:
        result = CalendarService.create_event_from_notice(
            db=db,
            user_id=current_user.user_id,
            notice_id=request.notice_id
        )
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail="공지사항을 찾을 수 없거나 AI 분석이 완료되지 않았습니다."
            )
        
        return success_response(result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"일정 생성 실패: {str(e)}")
