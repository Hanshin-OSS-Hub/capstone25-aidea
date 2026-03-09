# backend/main.py

"""
FastAPI 서버: 한신대 장학금 AI 비서

API 명세서 v1 기준으로 작성된 REST API 서버입니다.
"""

import sys
import os
import asyncio

# 프로젝트 루트에서 .env 로드 (backend/ 폴더에서 실행해도 동작)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
from concurrent.futures import ThreadPoolExecutor

# 경로 설정 (backend/ 또는 프로젝트 루트에서 실행 시 backend 패키지 인식)
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(_backend_dir)
sys.path.insert(0, _project_root)
sys.path.insert(0, _backend_dir)

# 에이전트 임포트
from agent.agent import ScholarshipAgent

# API 모듈 임포트
from api.schemas import ChatRequest, ChatResponse, ChatResponseData, SourceInfo, ErrorDetail
from api.exceptions import ValidationError, AITimeoutError, AIUpstreamError, InternalError
from api.responses import success_response

# 라우터 임포트 (공지, 관심, 대시보드, 캘린더, 인증)
from api.routers import notices, favorites, dashboard, calendar, auth

# ========================
# 로깅 설정
# ========================
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# FastAPI 앱 생성
# ========================
app = FastAPI(
    title="한신대 장학금 AI 비서",
    description="API 명세서 v1 기준",
    version="1.0.0"
)

# CORS 설정 (프론트엔드에서 접근 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
# 에이전트 전역 변수
# ========================
agent: ScholarshipAgent = None
executor = ThreadPoolExecutor(max_workers=1)

# ========================
# 서버 이벤트 핸들러
# ========================

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 ReAct 에이전트 로드"""
    global agent
    try:
        logger.info("🔄 [Server] ReAct 에이전트를 로딩 중입니다...")
        agent = ScholarshipAgent()
        logger.info("✅ [Server] ReAct 에이전트 로딩 완료!")
    except Exception as e:
        logger.error(f"❌ [Server] 에이전트 로딩 실패: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시"""
    logger.info("🛑 [Server] 서버 종료 중...")

# ========================
# 기본 엔드포인트
# ========================

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not ready")
    return {"status": "ok", "agent": "ReAct (LangGraph)"}


# ========================
# API 라우터 설정
# ========================

# /api/v1 라우터 생성
api_v1_router = APIRouter(prefix="/api/v1", tags=["API v1"])

# ========================
# API v1 엔드포인트
# ========================

@api_v1_router.post("/ai/chat")
async def chat_endpoint(request: ChatRequest):
    """
    AI 채팅 엔드포인트 (명세서 v1)
    
    POST /api/v1/ai/chat
    Body: {"user_id": 1, "message": "질문"}
    
    Response: {
        "success": true,
        "data": {
            "answer": "...",
            "sources": [...],
            "followups": [...]
        },
        "error": null
    }
    """
    
    # 에이전트 확인
    if agent is None:
        logger.error("❌ ReAct 에이전트가 초기화되지 않았습니다.")
        raise AIUpstreamError("AI service is not ready.")
    
    # 입력 검증
    if not request.message or not request.message.strip():
        raise ValidationError(
            "Message is required.",
            details=[ErrorDetail(field="message", reason="must not be empty")]
        )
    
    try:
        logger.info(f"📩 [Chat] 사용자 {request.user_id} 질문 수신: {request.message[:50]}...")
        
        # ReAct 에이전트를 스레드 풀에서 실행 (타임아웃 설정)
        loop = asyncio.get_event_loop()
        try:
            answer_text = await asyncio.wait_for(
                loop.run_in_executor(
                    executor, 
                    agent.ask,
                    request.message
                ),
                timeout=60.0  # 60초 타임아웃
            )
        except asyncio.TimeoutError:
            logger.error("❌ [Chat] 응답 생성 타임아웃 (60초 초과)")
            raise AITimeoutError("AI service timeout.")
        
        logger.info(f"📤 [Chat] 답변 생성 완료: {answer_text[:50]}...")
        
        # 응답 데이터 구성 (명세서 v1 형식)
        # TODO: sources와 followups는 추후 에이전트에서 추출하도록 개선 필요
        response_data = ChatResponseData(
            answer=answer_text,
            sources=[],  # 추후 에이전트에서 출처 정보 추출
            followups=[]  # 추후 에이전트에서 추천 질문 생성
        )
        
        # 명세서 v1 형식으로 응답 반환
        return {
            "success": True,
            "data": response_data.dict(),
            "error": None
        }
    
    except (AITimeoutError, AIUpstreamError, ValidationError):
        # 이미 처리된 예외는 그대로 전파
        raise
    except Exception as e:
        logger.error(f"❌ [Chat] 답변 생성 중 오류: {str(e)}")
        raise InternalError(f"Internal server error: {str(e)}")

# API v1 라우터 등록 (엔드포인트 정의 후)
app.include_router(api_v1_router)

# 세부 기능 라우터 등록 (공지, 북마크, 대시보드, 캘린더, 인증/회원)
app.include_router(notices.router, prefix="/api/v1")
app.include_router(favorites.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")

# ========================
# 예외 핸들러 (명세서 v1 형식으로 변환)
# ========================

from fastapi import Request
from fastapi.responses import JSONResponse

# ========================
# 예외 핸들러 (명세서 v1 형식으로 변환)
# ========================
# APIRouter에는 exception_handler가 없으므로 app에만 등록

@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    """검증 오류 핸들러"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": [{"field": d.field, "reason": d.reason} for d in (exc.details or [])]
            }
        }
    )

@app.exception_handler(AITimeoutError)
async def ai_timeout_error_handler(request: Request, exc: AITimeoutError):
    """AI 타임아웃 오류 핸들러"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": exc.error_code,
                "message": exc.message
            }
        }
    )

@app.exception_handler(AIUpstreamError)
async def ai_upstream_error_handler(request: Request, exc: AIUpstreamError):
    """AI 업스트림 오류 핸들러"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": exc.error_code,
                "message": exc.message
            }
        }
    )

@app.exception_handler(InternalError)
async def internal_error_handler(request: Request, exc: InternalError):
    """서버 내부 오류 핸들러"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "code": exc.error_code,
                "message": exc.message
            }
        }
    )

# ========================
# 서버 실행
# ========================

if __name__ == "__main__":
    logger.info("🚀 [Server] 한신대 장학금 AI 비서 서버 시작...")
    logger.info("📍 접속 주소: http://localhost:8000")
    logger.info("📚 API 문서: http://localhost:8000/docs")
    logger.info("🔗 API v1: http://localhost:8000/api/v1/ai/chat")
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        timeout_keep_alive=120,  # Keep-alive 타임아웃
    )
