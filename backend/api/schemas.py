# backend/api/schemas.py

"""
API 스키마 정의 (명세서 v1 기준)
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ========================
# 공통 응답 포맷
# ========================

class SuccessResponse(BaseModel):
    """성공 응답 포맷"""
    success: bool = True
    data: Any
    error: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """실패 응답 포맷"""
    success: bool = False
    data: Optional[Any] = None
    error: Dict[str, Any]


class ErrorDetail(BaseModel):
    """에러 상세 정보 (검증 실패용)"""
    field: str
    reason: str


class ValidationErrorResponse(ErrorResponse):
    """검증 실패 응답"""
    error: Dict[str, Any] = Field(
        ...,
        example={
            "code": "VALIDATION_ERROR",
            "message": "Invalid request parameter.",
            "details": [
                {"field": "end_date", "reason": "must be YYYY-MM-DD"}
            ]
        }
    )


# ========================
# AI 채팅 관련 스키마
# ========================

class ChatRequest(BaseModel):
    """AI 채팅 요청"""
    user_id: int = Field(..., description="사용자 ID")
    message: str = Field(..., description="사용자 메시지")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "message": "이번 학기 성적 장학금 조건 알려줘"
            }
        }


class SourceInfo(BaseModel):
    """출처 정보"""
    source: str = Field(..., description="출처 파일명")
    page: Optional[int] = Field(None, description="페이지 번호")
    category: Optional[str] = Field(None, description="카테고리")


class ChatResponseData(BaseModel):
    """AI 채팅 응답 데이터"""
    answer: str = Field(..., description="AI 답변")
    sources: List[SourceInfo] = Field(default_factory=list, description="출처 목록")
    followups: List[str] = Field(default_factory=list, description="추가 질문 제안")


class ChatResponse(BaseModel):
    """AI 채팅 응답"""
    success: bool = True
    data: ChatResponseData
    error: Optional[Dict[str, Any]] = None


# ========================
# 벡터 검색 관련 스키마
# ========================

class VectorSearchRequest(BaseModel):
    """벡터 검색 요청 (쿼리 파라미터)"""
    query: str = Field(..., description="검색 쿼리")
    top_k: int = Field(5, ge=1, le=20, description="상위 k개 결과")


class VectorSearchResult(BaseModel):
    """벡터 검색 결과 항목"""
    content: str = Field(..., description="검색된 내용")
    source: str = Field(..., description="출처 파일명")
    score: float = Field(..., description="유사도 점수")


class VectorSearchResponseData(BaseModel):
    """벡터 검색 응답 데이터"""
    results: List[VectorSearchResult] = Field(default_factory=list)
    query: str
    total: int


class VectorSearchResponse(SuccessResponse):
    """벡터 검색 응답"""
    data: VectorSearchResponseData
