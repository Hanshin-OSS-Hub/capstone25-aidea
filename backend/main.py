# backend/main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# 팀장님이 만든 AI 에이전트 가져오기
from backend.agent.agent import ScholarshipAgent

# 1. 앱 생성
app = FastAPI(title="한신대 장학금 AI 비서")

# 2. 데이터 형식 정의 (질문 받을 그릇)
class QuestionRequest(BaseModel):
    query: str

# 3. 에이전트 전역 변수 (서버 켜질 때 한 번만 로딩)
agent = None

@app.on_event("startup")
async def startup_event():
    """서버가 시작될 때 AI를 준비시킵니다."""
    global agent
    print("🔄 [Server] AI 에이전트를 로딩 중입니다...")
    agent = ScholarshipAgent()
    print("✅ [Server] AI 로딩 완료! 준비됐습니다.")

# 4. 질문 받는 주소 (API) 만들기
@app.post("/chat")
async def chat_endpoint(request: QuestionRequest):
    """
    프론트엔드에서 { "query": "질문" } 을 보내면
    AI가 답변을 { "answer": "답변" } 으로 줍니다.
    """
    if not agent:
        raise HTTPException(status_code=500, detail="AI가 아직 준비되지 않았습니다.")
    
    print(f"📩 질문 수신: {request.query}")
    
    # AI에게 물어보기
    response = agent.ask(request.query)
    
    print(f"📤 답변 발송: {response}")
    return {"answer": response}

# 5. 실행 코드
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)