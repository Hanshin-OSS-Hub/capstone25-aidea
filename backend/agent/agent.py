# backend/agent/agent.py

import os
import sys
import logging
from datetime import datetime

# 경로 설정
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(os.path.dirname(__file__)))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

# 도구 임포트 (기존 도구 사용)
from agent.tools import search_scholarship_rules

load_dotenv()

# ========================
# 로깅 설정
# ========================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ScholarshipAgent:
    """
    GPT-4o Native Tool Calling 기반 에이전트
    - 특징: 파싱 에러 없음, 더 정확한 의도 파악, 빠른 속도
    """
    
    def __init__(self):
        logger.info("⚡ [Init] Native Tool Agent 초기화 중...")
        
        # 1. 모델 설정 (Temperature를 0으로 낮춰서 도구 호출 정확도 향상)
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,  # 사실 기반 검색에는 0이 유리함
            max_tokens=1000
        )
        
        # 2. 도구 바인딩 (이게 핵심!)
        # LLM에게 "너는 이 도구를 쓸 수 있어"라고 알려주는 최신 방식
        self.tools = [search_scholarship_rules]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 3. 시스템 프롬프트 설정
        self.system_prompt = """
        당신은 한신대학교 장학금 및 학사 규정 전문가 '한신봇'입니다.
        
        [원칙]
        1. 질문에 답하기 위해 반드시 제공된 도구(search_scholarship_rules)를 사용하여 규정을 확인하세요.
        2. 사용자의 질문이 모호하면 도구를 사용하여 다양한 키워드로 검색을 시도하세요.
        3. 검색된 정보가 없다면 솔직하게 없다고 말하고, 학생복지팀(031-379-0049) 문의를 안내하세요.
        4. 최종 답변은 친절하게, 핵심 정보(금액, 기간, 자격) 위주로 요약하세요.
        """
        
        logger.info("✅ [Init] 에이전트 준비 완료")

    def ask(self, query: str) -> str:
        if not query.strip():
            return "질문을 입력해주세요."

        logger.info("\n" + "="*60)
        logger.info(f"🎯 [질문] {query}")
        
        # 대화 기록 초기화 (시스템 메시지 + 사용자 질문)
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=query)
        ]
        
        start_time = datetime.now()
        
        # === 루프 시작 (최대 3회 반복) ===
        for i in range(3):
            logger.info(f"🔄 [Step {i+1}] LLM 추론 중...")
            
            # 1. LLM 호출
            ai_msg = self.llm_with_tools.invoke(messages)
            
            # 메시지 기록에 AI 응답 추가
            messages.append(ai_msg)

            # 2. 도구 호출 여부 확인
            if ai_msg.tool_calls:
                # LLM이 도구를 쓰겠다고 판단함
                for tool_call in ai_msg.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]
                    
                    logger.info(f"🛠️  [도구 실행] {tool_name} / 인자: {tool_args}")
                    
                    # 도구 실행 (여기서는 도구가 하나뿐이므로 바로 실행)
                    if tool_name == "search_scholarship_rules":
                        # 실제 도구 함수 실행
                        tool_output = search_scholarship_rules.invoke(tool_args)
                        logger.info(f"📄 [검색 결과] {len(str(tool_output))}자 확보")
                        
                        # 도구 결과를 메시지 기록에 추가 (ToolMessage)
                        messages.append(ToolMessage(
                            content=str(tool_output),
                            tool_call_id=tool_id
                        ))
            else:
                # 도구 호출이 없으면 최종 답변으로 간주하고 루프 종료
                logger.info("✅ 최종 답변 생성 완료")
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(f"⏱️  소요 시간: {elapsed:.2f}초")
                logger.info("="*60 + "\n")
                return ai_msg.content

        return "죄송합니다. 규정을 찾는 데 시간이 너무 오래 걸려 답변을 완료하지 못했습니다."

# ========================
# 테스트 실행
# ========================
if __name__ == "__main__":
    bot = ScholarshipAgent()
    
    while True:
        q = input("\n💬 질문: ").strip()
        if q.lower() == "exit": break
        
        answer = bot.ask(q)
        print(f"\n🤖 답변:\n{answer}")