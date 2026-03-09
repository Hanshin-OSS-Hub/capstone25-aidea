"""
관심 공지 API 라우터
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.services.notice_service import NoticeService
from backend.api.responses import success_response
from backend.api.exceptions import ValidationError, InternalError

router = APIRouter(prefix="/favorites", tags=["Favorites"])


class FavoriteRequest(BaseModel):
    """관심 등록 요청"""
    user_id: int
    notice_id: int


@router.post("")
async def add_favorite(
    request: FavoriteRequest,
    db: Session = Depends(get_db)
):
    """
    관심 공지 등록
    
    POST /api/v1/favorites
    Body: {"user_id": 1, "notice_id": 123}
    
    Response:
        201: {"success": true, "data": {"created": true}, "error": null}
        409: {"success": false, "data": null, "error": {"code": "CONFLICT", "message": "Already favorited."}}
    """
    try:
        created = NoticeService.add_favorite(
            db=db,
            user_id=request.user_id,
            notice_id=request.notice_id
        )
        
        if not created:
            # 이미 관심 등록되어 있음
            raise HTTPException(
                status_code=409,
                detail={"code": "CONFLICT", "message": "Already favorited."}
            )
        
        return success_response({"created": True})
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"관심 등록 실패: {str(e)}")


@router.delete("/{notice_id}")
async def remove_favorite(
    notice_id: int,
    user_id: int = Query(1, description="사용자 ID"),
    db: Session = Depends(get_db)
):
    """
    관심 공지 해제
    
    DELETE /api/v1/favorites/{notice_id}?user_id=1
    
    Response:
        200: {"success": true, "data": {"deleted": true}, "error": null}
        404: 관심 등록되지 않은 경우
    """
    try:
        deleted = NoticeService.remove_favorite(
            db=db,
            user_id=user_id,
            notice_id=notice_id
        )
        
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail="관심 등록된 공지사항이 아닙니다."
            )
        
        return success_response({"deleted": True})
        
    except HTTPException:
        raise
    except Exception as e:
        raise InternalError(f"관심 해제 실패: {str(e)}")
