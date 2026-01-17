# backend/main.py

"""
FastAPI 서버: 한신대 장학금 AI 비서

ReAct 에이전트를 프론트엔드와 연결하는 REST API 서버입니다.
"""

import sys
import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
from concurrent.futures import ThreadPoolExecutor

# 경로 설정
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 에이전트 임포트
from agent.agent import ScholarshipAgent

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
    description="LangGraph 기반 ReAct 에이전트",
    version="2.0.0"
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
# 데이터 모델
# ========================

class QuestionRequest(BaseModel):
    """질문 요청 형식"""
    query: str

    class Config:
        json_schema_extra = {
            "example": {
                "query": "장학금을 받으려면 어떻게 해야 하나요?"
            }
        }

class AnswerResponse(BaseModel):
    """답변 응답 형식"""
    answer: str
    status: str = "success"

    class Config:
        json_schema_extra = {
            "example": {
                "answer": "장학금 신청 절차는...",
                "status": "success"
            }
        }

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
# API 엔드포인트
# ========================

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not ready")
    return {"status": "ok", "agent": "ReAct (LangGraph)"}

@app.post("/chat", response_model=AnswerResponse)
async def chat_endpoint(request: QuestionRequest) -> AnswerResponse:
    """
    ReAct 에이전트를 통한 질문-응답 엔드포인트
    
    프론트엔드에서 { "query": "질문" }을 보내면
    AI가 답변을 { "answer": "답변", "status": "success" }로 반환합니다.
    
    Args:
        request: QuestionRequest 모델 (query 포함)
    
    Returns:
        AnswerResponse 모델 (answer와 status 포함)
    """
    
    # 에이전트 확인
    if agent is None:
        logger.error("❌ ReAct 에이전트가 초기화되지 않았습니다.")
        raise HTTPException(
            status_code=503, 
            detail="ReAct 에이전트가 준비되지 않았습니다."
        )
    
    # 입력 검증
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="질문을 입력해주세요."
        )
    
    try:
        logger.info(f"📩 [Chat] 질문 수신: {request.query[:50]}...")
        
        # ReAct 에이전트를 스레드 풀에서 실행 (타임아웃 방지)
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor, 
            agent.ask,
            request.query
        )
        
        logger.info(f"📤 [Chat] 답변 생성 완료: {response[:50]}...")
        
        return AnswerResponse(
            answer=response,
            status="success"
        )
    
    except Exception as e:
        logger.error(f"❌ [Chat] 답변 생성 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"답변 생성 중 오류가 발생했습니다: {str(e)}"
        )

# ========================
# 서버 실행
# ========================

if __name__ == "__main__":
    logger.info("🚀 [Server] 한신대 장학금 AI 비서 서버 시작...")
    logger.info("📍 접속 주소: http://localhost:8000")
    logger.info("📚 API 문서: http://localhost:8000/docs")
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        timeout_keep_alive=120,  # Keep-alive 타임아웃
        timeout_notify=120,      # 타임아웃 알림
    )