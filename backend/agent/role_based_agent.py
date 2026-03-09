# backend/agent/role_based_agent.py

"""
Role 기반 에이전트 (성능 개선 버전)

각 역할별로 최적화된 검색 전략을 사용하여 성능을 향상시킵니다.
"""

import os
import sys
import logging
from datetime import datetime
import hashlib
from typing import List, Dict, Optional

# 경로 설정
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(os.path.dirname(__file__)))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

# 도구 임포트
from agent.tools import search_scholarship_rules

load_dotenv()

logger = logging.getLogger(__name__)


class RoleBasedAgent:
    """
    Role 기반 에이전트
    
    역할:
    1. 장학금 전문가 (Scholarship Expert)
    2. 학사 규정 전문가 (Academic Rules Expert)
    3. 일정 관리 전문가 (Schedule Expert)
    4. 공지사항 전문가 (Notice Expert)
    
    각 역할별로 최적화된 검색 전략을 사용합니다.
    """
    
    # 역할별 키워드 매핑
    ROLE_KEYWORDS = {
        "scholarship": ["장학금", "장학", "성적장학금", "나눔장학금", "입학장학금", "신청", "지원", "선발"],
        "academic": ["학사", "졸업", "휴학", "복학", "전과", "부전공", "복수전공", "이수", "학점"],
        "schedule": ["일정", "기간", "마감", "신청기간", "접수", "시험", "등록"],
        "notice": ["공지", "안내", "알림", "공고", "발표"]
    }
    
    # 역할별 검색 전략
    ROLE_SEARCH_STRATEGIES = {
        "scholarship": {
            "keywords": ["장학금", "신청", "자격", "기준", "금액", "지급"],
            "focus": "장학금 종류, 신청 조건, 지급 방법"
        },
        "academic": {
            "keywords": ["학사", "규정", "절차", "요건", "조건"],
            "focus": "학사 규정, 절차, 요건"
        },
        "schedule": {
            "keywords": ["기간", "일정", "마감", "시작", "종료"],
            "focus": "일정, 기간, 마감일"
        },
        "notice": {
            "keywords": ["공지", "안내", "공고"],
            "focus": "공지사항 내용"
        }
    }
    
    def __init__(self, cache_size: int = 100):
        logger.info("⚡ [Init] Role-Based Agent 초기화 중...")
        
        # LLM 설정
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            max_tokens=3000
        )
        
        self.tools = [search_scholarship_rules]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 캐시
        self.cache = {}
        self.cache_size = cache_size
        
        # 역할 분류 프롬프트
        self.role_classifier_prompt = """
        사용자의 질문을 분석하여 가장 적합한 역할을 선택하세요.
        
        역할:
        1. scholarship (장학금): 장학금 신청, 자격, 금액, 지급 등
        2. academic (학사 규정): 졸업, 휴학, 복학, 전과, 부전공 등
        3. schedule (일정): 신청 기간, 마감일, 일정 등
        4. notice (공지사항): 공지, 안내, 공고 등
        
        질문: {query}
        
        역할을 하나만 선택하고, 해당 역할의 이름만 반환하세요 (예: "scholarship")
        """
        
        # 역할별 시스템 프롬프트
        self.role_prompts = {
            "scholarship": """
            당신은 한신대학교 장학금 전문가입니다.
            
            [전문 분야]
            - 장학금 종류 및 신청 방법
            - 장학금 자격 요건 및 선발 기준
            - 장학금 지급 금액 및 기간
            - 장학금 신청 기간 및 절차
            
            [검색 전략]
            - "장학금" + 구체적 장학금명 (예: "나눔장학금", "성적장학금")
            - "장학금 신청" + 관련 키워드 (예: "기간", "자격", "금액")
            - 장학금 종류별로 구체적으로 검색
            
            [답변 형식]
            - 장학금 종류 명시
            - 신청 기간 및 자격 요건
            - 지급 금액 및 방법
            - 출처 정보 포함
            """,
            
            "academic": """
            당신은 한신대학교 학사 규정 전문가입니다.
            
            [전문 분야]
            - 졸업 요건 및 절차
            - 휴학/복학 신청 및 절차
            - 전과, 부전공, 복수전공 규정
            - 학점 이수 및 성적 규정
            
            [검색 전략]
            - 구체적 규정명 검색 (예: "휴학", "졸업", "부전공")
            - 규정 + 절차/요건 조합 검색
            - 관련 규정을 여러 번 검색하여 종합
            
            [답변 형식]
            - 규정명 및 적용 범위
            - 신청 절차 및 요건
            - 주의사항 및 제한사항
            - 출처 정보 포함
            """,
            
            "schedule": """
            당신은 한신대학교 일정 관리 전문가입니다.
            
            [전문 분야]
            - 각종 신청 기간 및 마감일
            - 시험 일정 및 등록 일정
            - 행사 및 프로그램 일정
            
            [검색 전략]
            - "기간", "일정", "마감" + 구체적 항목명 검색
            - 날짜 관련 키워드 중심 검색
            - 학기별, 월별 일정 검색
            
            [답변 형식]
            - 구체적 일정 및 기간 명시
            - 마감일 강조
            - D-day 계산 (가능한 경우)
            - 출처 정보 포함
            """,
            
            "notice": """
            당신은 한신대학교 공지사항 전문가입니다.
            
            [전문 분야]
            - 학교 공지사항 내용
            - 안내사항 및 공고
            
            [검색 전략]
            - 공지사항 제목 및 키워드 검색
            - 최신 공지사항 우선 검색
            
            [답변 형식]
            - 공지사항 요약
            - 중요 내용 강조
            - 관련 링크 및 출처 포함
            """
        }
        
        logger.info("✅ [Init] Role-Based Agent 준비 완료")
    
    def _classify_role(self, query: str) -> str:
        """질문을 분석하여 적합한 역할을 분류합니다."""
        query_lower = query.lower()
        
        # 키워드 기반 빠른 분류
        role_scores = {}
        for role, keywords in self.ROLE_KEYWORDS.items():
            score = sum(1 for keyword in keywords if keyword in query_lower)
            role_scores[role] = score
        
        # 가장 높은 점수의 역할 선택
        if role_scores:
            best_role = max(role_scores.items(), key=lambda x: x[1])[0]
            if role_scores[best_role] > 0:
                logger.info(f"🎭 [Role] 분류 결과: {best_role} (점수: {role_scores[best_role]})")
                return best_role
        
        # 기본값: scholarship (가장 일반적)
        logger.info("🎭 [Role] 기본 역할 선택: scholarship")
        return "scholarship"
    
    def _get_role_specific_keywords(self, query: str, role: str) -> List[str]:
        """역할별 최적화된 키워드 추출"""
        strategy = self.ROLE_SEARCH_STRATEGIES.get(role, {})
        base_keywords = strategy.get("keywords", [])
        
        # 질문에서 역할 관련 키워드 추출
        extracted = []
        for keyword in base_keywords:
            if keyword in query:
                extracted.append(keyword)
        
        # 원본 질문도 포함
        keywords = [query] + extracted + base_keywords[:3]
        return list(set(keywords))[:5]  # 최대 5개
    
    def _get_cache_key(self, query: str) -> str:
        """캐시 키 생성"""
        normalized = query.strip().lower().replace(" ", "")
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def ask(self, query: str) -> str:
        """질문에 답변합니다."""
        if not query.strip():
            return "질문을 입력해주세요."
        
        logger.info("\n" + "="*60)
        logger.info(f"🎯 [질문] {query}")
        
        # 캐시 확인
        cache_key = self._get_cache_key(query)
        if cache_key in self.cache:
            logger.info("⚡ [Cache] 캐시에서 답변을 찾았습니다!")
            return self.cache[cache_key]
        
        # 역할 분류
        role = self._classify_role(query)
        logger.info(f"🎭 [Role] 선택된 역할: {role}")
        
        # 역할별 키워드 추출
        keywords = self._get_role_specific_keywords(query, role)
        logger.info(f"🔑 [Keywords] 역할별 키워드: {keywords[:3]}")
        
        # 역할별 시스템 프롬프트 설정
        system_prompt = self.role_prompts.get(role, self.role_prompts["scholarship"])
        
        # 대화 기록 초기화
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"질문: {query}\n\n이 질문에 답하기 위해 다음 키워드들을 고려해보세요: {', '.join(keywords[:3])}")
        ]
        
        start_time = datetime.now()
        
        # ReAct 루프 (최대 8회)
        search_attempts = 0
        max_search_attempts = 5
        
        for i in range(8):
            logger.info(f"🔄 [Step {i+1}] LLM 추론 중...")
            
            try:
                ai_msg = self.llm_with_tools.invoke(messages)
            except Exception as e:
                logger.error(f"❌ [Step {i+1}] LLM 호출 실패: {str(e)}")
                if i == 0:
                    continue
                else:
                    return f"죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
            
            messages.append(ai_msg)
            
            if ai_msg.tool_calls:
                search_attempts += 1
                
                if search_attempts > max_search_attempts:
                    logger.warning(f"⚠️ 검색 시도 횟수 초과 ({max_search_attempts}회)")
                    break
                
                for tool_call in ai_msg.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]
                    
                    logger.info(f"🛠️  [도구 실행] {tool_name} / 인자: {tool_args}")
                    
                    if tool_name == "search_scholarship_rules":
                        try:
                            tool_output = search_scholarship_rules.invoke(tool_args)
                            output_str = str(tool_output)
                            logger.info(f"📄 [검색 결과] {len(output_str)}자 확보")
                            
                            if "검색 결과가 없습니다" in output_str or len(output_str) < 50:
                                if search_attempts < len(keywords) and search_attempts < max_search_attempts:
                                    next_keyword = keywords[search_attempts] if search_attempts < len(keywords) else keywords[-1]
                                    logger.info(f"🔄 [재검색] 역할별 키워드 '{next_keyword}'로 재검색")
                                    messages.append(HumanMessage(
                                        content=f"이전 검색 결과가 부족했습니다. 역할 '{role}'에 특화된 키워드 '{next_keyword}'로 다시 검색해주세요."
                                    ))
                            
                            messages.append(ToolMessage(
                                content=output_str,
                                tool_call_id=tool_id
                            ))
                        except Exception as e:
                            logger.error(f"❌ 도구 실행 실패: {str(e)}")
                            messages.append(ToolMessage(
                                content=f"검색 중 오류가 발생했습니다: {str(e)}",
                                tool_call_id=tool_id
                            ))
            else:
                logger.info("✅ 최종 답변 생성 완료")
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(f"⏱️  소요 시간: {elapsed:.2f}초")
                
                answer = ai_msg.content
                if len(self.cache) >= self.cache_size:
                    oldest_key = next(iter(self.cache))
                    del self.cache[oldest_key]
                self.cache[cache_key] = answer
                
                logger.info("="*60 + "\n")
                return answer
        
        # 최종 답변 생성
        logger.info("🔄 [Final] 최종 답변 생성 시도...")
        final_msg = self.llm.invoke(messages)
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"⏱️  소요 시간: {elapsed:.2f}초")
        
        if final_msg.content:
            answer = final_msg.content
            if len(self.cache) >= self.cache_size:
                oldest_key = next(iter(self.cache))
                del self.cache[oldest_key]
            self.cache[cache_key] = answer
            
            logger.info("="*60 + "\n")
            return answer
        else:
            error_msg = "죄송합니다. 규정을 찾는 데 시간이 너무 오래 걸려 답변을 완료하지 못했습니다. 학생복지팀(031-379-0049)으로 직접 문의해주세요."
            logger.info("="*60 + "\n")
            return error_msg
