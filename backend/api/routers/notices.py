"""
공지사항 API 라우터
"""

import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.services.notice_service import NoticeService
from backend.api.responses import success_response
from backend.api.exceptions import ValidationError, InternalError
from backend.models.user import User
from backend.api.routers.auth import get_current_user

router = APIRouter(prefix="/notices", tags=["Notices"])


@router.get("")
async def get_notices_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    sort: str = Query("latest", description="정렬 방식 (latest/deadline)"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    tag: Optional[str] = Query(None, description="태그 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    공지사항 리스트 조회
    
    GET /api/v1/notices?page=1&size=20&sort=latest&category=장학금
    """
    try:
        result = NoticeService.get_notices_list(
            db=db,
            user_id=current_user.user_id,
            page=page,
            size=size,
            sort=sort,
            category=category,
            tag=tag
        )
        
        return success_response(result)
        
    except Exception as e:
        logging.error(f"공지사항 조회 실패: {e}\n{traceback.format_exc()}")
        raise InternalError(f"공지사항 조회 실패: {str(e)}")


@router.post("/{notice_id}/analyze")
async def analyze_notice(
    notice_id: int,
    db: Session = Depends(get_db)
):
    """
    공지사항 AI 요약 생성 (온디맨드)
    
    POST /api/v1/notices/{notice_id}/analyze
    
    - DB에 있는 공지에 대해 GPT로 3줄 요약, 카테고리, 마감일 추출
    - .env의 OPENAI_API_KEY 필요
    """
    try:
        from backend.services.ai_analyze_service import analyze_notice as do_analyze
        success = do_analyze(db, notice_id)
        if not success:
            raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
        
        # 업데이트된 상세 정보 반환
        result = NoticeService.get_notice_detail(db, notice_id, user_id=1)
        return success_response(result)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise InternalError(f"AI 요약 생성 실패: {str(e)}")


@router.get("/{notice_id}")
async def get_notice_detail(
    notice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    공지사항 상세 조회
    
    GET /api/v1/notices/{notice_id}?user_id=1
    """
    try:
        result = NoticeService.get_notice_detail(
            db=db,
            notice_id=notice_id,
            user_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
        
        return success_response(result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"공지사항 상세 조회 실패: {str(e)}")
