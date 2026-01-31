# backend/api/responses.py

"""
API 응답 헬퍼 함수 (명세서 v1 기준)
"""

from typing import Any, Optional, Dict
from fastapi.responses import JSONResponse
from fastapi import status
from .schemas import ErrorDetail


def success_response(data: Any, status_code: int = status.HTTP_200_OK) -> JSONResponse:
    """성공 응답 생성"""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": data,
            "error": None
        }
    )


def error_response(
    error_code: str,
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    details: Optional[list] = None
) -> JSONResponse:
    """에러 응답 생성"""
    error_dict = {
        "code": error_code,
        "message": message
    }
    
    if details:
        error_dict["details"] = details
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": error_dict
        }
    )
