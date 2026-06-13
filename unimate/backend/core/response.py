from typing import Any


def success(data: Any) -> dict:
    """모든 성공 응답은 이 헬퍼를 통해 반환"""
    return {"success": True, "data": data, "error": None}


def error(code: str, message: str) -> dict:
    """모든 에러 응답은 이 헬퍼를 통해 반환"""
    return {"success": False, "data": None, "error": {"code": code, "message": message}}
