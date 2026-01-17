# backend/agent/agent.py

import os
import sys
import json
import logging
from typing import Literal, Annotated
from datetime import datetime

# 경로 설정 (에러 방지용)
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(os.path.dirname(__file__)))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

# 도구 임포트
from agent.tools import search_scholarship_rules, generate_answer

load_dotenv()

# ========================
# 로깅 설정
# ========================
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# ReAct Agent 상태 정의
# ========================

class AgentState(TypedDict):
    """에이전트의 상태"""
    messages: Annotated[list[BaseMessage], "The messages in the conversation"]
    question: str  # 사용자 질문
    search_result: str  # 검색 결과
    final_answer: str  # 최종 답변

# ========================
# 에이전트 구성 요소
# ========================

class ScholarshipAgent:
    def __init__(self):
        """ReAct 에이전트 초기화"""
        
        # 1. LLM 설정
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)
        
        # 2. LLM에 도구 연결
        self.tools = [search_scholarship_rules, generate_answer]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 3. 에이전트 그래프 구성
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """LangGraph를 사용하여 ReAct 에이전트 그래프 구성"""
        
        workflow = StateGraph(AgentState)
        
        # 노드 1: 에이전트 실행 (LLM이 도구 선택)
        def agent_node(state: AgentState) -> AgentState:
            """LLM이 도구를 선택하여 실행"""
            
            logger.info("=" * 80)
            logger.info("🤖 [Agent Node] 에이전트가 사고 중입니다...")
            logger.info("=" * 80)
            
            # 현재 메시지 상태 로깅
            for i, msg in enumerate(state["messages"]):
                if isinstance(msg, HumanMessage):
                    logger.info(f"📝 [메시지 {i}] HumanMessage: {msg.content[:100]}")
                elif isinstance(msg, AIMessage):
                    logger.info(f"🤖 [메시지 {i}] AIMessage (length={len(msg.content)})")
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        logger.info(f"   └─ 도구 호출 감지: {len(msg.tool_calls)}개")
                        for tool_call in msg.tool_calls:
                            logger.info(f"      • {tool_call['name']}: {tool_call['args']}")
                elif isinstance(msg, ToolMessage):
                    logger.info(f"🔧 [메시지 {i}] ToolMessage: {msg.content[:100]}")
                else:
                    logger.info(f"❓ [메시지 {i}] {type(msg).__name__}")
            
            # 프롬프트: 에이전트에게 지시
            system_prompt = SystemMessage(content="""
당신은 한신대학교 장학금 및 학사 규정 전문 AI 어시스턴트입니다.

사용자의 질문에 답변하기 위해 다음 프로세스를 따르세요:
1. 먼저 search_scholarship_rules 도구로 규정을 검색하세요.
2. 검색 결과를 받으면, generate_answer 도구로 최종 답변을 만드세요.
3. 반드시 두 도구를 모두 순서대로 사용하세요.
            """)
            
            messages = [system_prompt] + state["messages"]
            
            logger.info("🔍 [LLM 호출] ChatOpenAI(gpt-4o)를 호출합니다...")
            
            # LLM 호출
            response = self.llm_with_tools.invoke(messages)
            
            logger.info("✅ [LLM 응답 받음]")
            
            # 응답 분석
            if hasattr(response, "tool_calls") and response.tool_calls:
                logger.info(f"🔧 [도구 호출 결정됨] {len(response.tool_calls)}개의 도구 호출")
                for i, tool_call in enumerate(response.tool_calls, 1):
                    logger.info(f"   {i}. {tool_call['name']}")
                    logger.info(f"      입력: {json.dumps(tool_call['args'], ensure_ascii=False, indent=2)}")
            else:
                logger.info("📋 [도구 호출 없음] LLM이 직접 응답을 생성했습니다.")
            
            # 메시지 히스토리에 추가
            new_messages = state["messages"] + [response]
            
            logger.info("=" * 80)
            
            return {
                **state,
                "messages": new_messages,
            }
        
        # 노드 2: 도구 실행 (직접 구현)
        def tool_node(state: AgentState) -> dict:
            """LLM이 선택한 도구를 실행"""
            
            logger.info("=" * 80)
            logger.info("🔧 [Tool Node] 도구 실행 중...")
            logger.info("=" * 80)
            
            last_message = state["messages"][-1]
            
            # 도구 호출 정보 추출
            tool_calls = last_message.tool_calls if hasattr(last_message, "tool_calls") else []
            
            logger.info(f"📊 [도구 호출 정보] 총 {len(tool_calls)}개의 도구 호출")
            
            new_messages = []
            new_state = {**state}
            
            for idx, tool_call in enumerate(tool_calls, 1):
                tool_name = tool_call["name"]
                tool_input = tool_call["args"]
                tool_id = tool_call["id"]
                
                logger.info(f"\n🔨 [도구 {idx}/{len(tool_calls)}] {tool_name}")
                logger.info(f"   ID: {tool_id}")
                logger.info(f"   입력: {json.dumps(tool_input, ensure_ascii=False, indent=2)}")
                
                # 도구 실행
                try:
                    if tool_name == "search_scholarship_rules":
                        logger.info(f"   ⏳ 벡터 DB 검색 중...")
                        result = search_scholarship_rules.invoke(tool_input)
                        logger.info(f"   ✅ 검색 완료")
                        logger.info(f"   📄 검색 결과 길이: {len(str(result))} 문자")
                        new_state["search_result"] = result
                        
                    elif tool_name == "generate_answer":
                        logger.info(f"   ⏳ 답변 생성 중...")
                        result = generate_answer.invoke(tool_input)
                        logger.info(f"   ✅ 답변 생성 완료")
                        logger.info(f"   📝 답변 길이: {len(str(result))} 문자")
                        logger.info(f"   📋 답변 미리보기: {str(result)[:150]}...")
                        new_state["final_answer"] = result
                        
                    else:
                        result = f"Unknown tool: {tool_name}"
                        logger.warning(f"   ⚠️ 알 수 없는 도구: {tool_name}")
                    
                    # ToolMessage 추가
                    tool_message = ToolMessage(
                        content=str(result),
                        tool_call_id=tool_id
                    )
                    new_messages.append(tool_message)
                    logger.info(f"   ✅ ToolMessage 생성 완료")
                    
                except Exception as e:
                    logger.error(f"   ❌ 도구 실행 오류: {str(e)}", exc_info=True)
                    tool_message = ToolMessage(
                        content=f"Tool execution error: {str(e)}",
                        tool_call_id=tool_id
                    )
                    new_messages.append(tool_message)
            
            # 상태 업데이트
            new_state["messages"] = state["messages"] + new_messages
            
            logger.info(f"\n📤 [상태 업데이트] 메시지 {len(state['messages'])} → {len(new_state['messages'])}")
            logger.info("=" * 80)
            
            return new_state
        
        # 조건부 라우팅: 도구 호출이 있으면 tool_node, 없으면 END
        def should_continue(state: AgentState) -> Literal["tools", "end"]:
            """메시지에 tool_calls가 있으면 도구 실행, 없으면 종료"""
            last_message = state["messages"][-1]
            
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                logger.info(f"🚦 [라우팅 결정] → tools (도구 호출 {len(last_message.tool_calls)}개)")
                return "tools"
            
            logger.info(f"🚦 [라우팅 결정] → end (도구 호출 없음, 종료)")
            return "end"
        
        # 노드 추가
        workflow.add_node("agent", agent_node)
        workflow.add_node("tools", tool_node)
        
        # 엣지(edge) 추가
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                "end": END,
            },
        )
        workflow.add_edge("tools", "agent")  # 도구 실행 후 다시 에이전트로
        
        # 그래프 컴파일
        return workflow.compile()
    
    def ask(self, query: str) -> str:
        """
        질문을 받아 ReAct 에이전트로 처리하고 최종 답변 반환
        
        Args:
            query (str): 사용자 질문
            
        Returns:
            str: 최종 답변
        """
        if not query:
            return "질문을 입력해주세요."
        
        logger.info("\n" + "🎯" * 40)
        logger.info(f"🎯 [새로운 질문] {query}")
        logger.info("🎯" * 40)
        
        # 초기 상태 설정
        initial_state: AgentState = {
            "messages": [HumanMessage(content=query)],
            "question": query,
            "search_result": "",
            "final_answer": "",
        }
        
        logger.info(f"📍 [초기 상태] 메시지 1개, 그래프 시작...")
        
        # 그래프 실행
        try:
            final_state = self.graph.invoke(initial_state)
        except Exception as e:
            logger.error(f"❌ [그래프 실행 오류] {str(e)}", exc_info=True)
            raise
        
        logger.info(f"\n✅ [그래프 실행 완료]")
        logger.info(f"   최종 메시지 개수: {len(final_state['messages'])}")
        logger.info(f"   검색 결과: {'있음' if final_state.get('search_result') else '없음'}")
        logger.info(f"   최종 답변: {'있음' if final_state.get('final_answer') else '없음'}")
        
        # 최종 답변 반환
        answer = final_state.get("final_answer", "답변을 생성할 수 없습니다.")
        logger.info(f"\n📤 [최종 답변 반환] {len(answer)} 문자")
        logger.info("=" * 80 + "\n")
        
        return answer

# ========================
# 테스트 실행
# ========================

if __name__ == "__main__":
    bot = ScholarshipAgent()
    print("🤖 ReAct 에이전트가 준비되었습니다! (LangGraph 기반)")
    print("=" * 50)
    
    while True:
        user_input = input("\n질문: ")
        if user_input.lower() == "exit":
            print("종료합니다.")
            break
        
        print("\n⏳ 처리 중...")
        response = bot.ask(user_input)
        print(f"\n답변: {response}")
        print("=" * 50)