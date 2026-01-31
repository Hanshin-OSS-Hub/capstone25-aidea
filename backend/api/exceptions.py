# backend/api/exceptions.py

"""
API 예외 처리 (명세서 v1 기준)
"""

from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any
from .schemas import ErrorDetail


class APIException(HTTPException):
    """기본 API 예외"""
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[List[ErrorDetail]] = None
    ):
        self.error_code = error_code
        self.message = message
        self.details = details
        
        error_dict = {
            "code": error_code,
            "message": message
        }
        
        if details:
            error_dict["details"] = [{"field": d.field, "reason": d.reason} for d in details]
        
        super().__init__(
            status_code=status_code,
            detail=error_dict
        )


class ValidationError(APIException):
    """검증 오류 (400)"""
    def __init__(self, message: str = "Invalid request parameter.", details: Optional[List[ErrorDetail]] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR",
            message=message,
            details=details
        )


class NotFoundError(APIException):
    """리소스 없음 (404)"""
    def __init__(self, message: str = "Resource not found."):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
            message=message
        )


class ConflictError(APIException):
    """중복 오류 (409)"""
    def __init__(self, message: str = "Resource already exists."):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
            message=message
        )


class AITimeoutError(APIException):
    """AI 타임아웃 (504)"""
    def __init__(self, message: str = "AI service timeout."):
        super().__init__(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            error_code="AI_TIMEOUT",
            message=message
        )


class AIUpstreamError(APIException):
    """AI 업스트림 오류 (502)"""
    def __init__(self, message: str = "AI service error."):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            error_code="AI_UPSTREAM_ERROR",
            message=message
        )


class InternalError(APIException):
    """서버 내부 오류 (500)"""
    def __init__(self, message: str = "Internal server error."):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
            message=message
        )
