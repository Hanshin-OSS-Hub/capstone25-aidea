# backend/agent/agent.py

import os
import sys
import logging
from datetime import datetime
from functools import lru_cache
from typing import Tuple, List
import hashlib

# 경로 설정
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(os.path.dirname(__file__)))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

# 도구 임포트 (기존 도구 사용)
from agent.tools import search_scholarship_rules, search_notices, get_recent_notices, search_notices_by_deadline

load_dotenv()

# ========================
# 로깅 설정
# ========================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# 동의어·축약어 매핑 (사용자 colloquial 표현 → 검색용 정식 키워드)
# "근장", "근로" 등 축약어로도 검색 가능하도록
# ========================
QUERY_SYNONYMS = {
    # 근로장학생 관련
    "근장": "근로장학생",
    "근로": "근로장학생",
    "근로장학": "근로장학생",
    "근로학생": "근로장학생",
    # 장학금 종류
    "성적장학": "성적장학금",
    "나눔장학": "나눔장학금",
    "입학장학": "입학장학금",
    "국장": "국비장학금",
    "국비": "국비장학금",
    "등록장학": "등록장학금",
    "교내장학": "교내장학금",
    "교외장학": "교외장학금",
    # 학사 관련
    "휴학": "휴학",
    "복학": "복학",
    "전과": "전과",
    "부전공": "부전공",
    "복전": "복수전공",
    "복수전공": "복수전공",
    # 공지 관련
    "공지": "공지",
    "공고": "공고",
    "안내": "안내",
    "모집": "모집",
    "신청": "신청",
}


class ScholarshipAgent:
    """
    GPT-4o Native Tool Calling 기반 에이전트
    - 특징: 파싱 에러 없음, 더 정확한 의도 파악, 빠른 속도
    - 성능 개선: 응답 캐싱, 검색 품질 향상
    """
    
    def __init__(self, cache_size: int = 100):
        logger.info("⚡ [Init] Native Tool Agent 초기화 중...")
        
        # 1. 모델 설정 (Temperature를 0으로 낮춰서 도구 호출 정확도 향상)
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,  # 사실 기반 검색에는 0이 유리함
            max_tokens=3000  # 복잡한 질문에 대한 긴 답변을 위해 증가
        )
        
        # 2. 도구 바인딩 (규정 검색 + 공지사항 검색)
        self.tools = [search_scholarship_rules, search_notices, get_recent_notices, search_notices_by_deadline]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 3. 응답 캐시 (같은 질문에 대한 빠른 응답)
        self.cache = {}
        self.cache_size = cache_size
        
        # 3. 시스템 프롬프트 설정 (Few-shot 예시 포함, 복잡한 질문 처리 강화)
        self.system_prompt = """
        당신은 한신대학교 장학금 및 학사 규정 전문가 '한신봇'입니다.
        
        [핵심: 공지 vs 규정 구분]
        - **공지** = 학교에서 올린 실제 공고/안내문 (선발기간, 신청기간, 마감일, 2026년 일정 등). 반드시 search_notices 또는 get_recent_notices로 DB 공지사항을 검색하세요.
        - **규정** = 장학금/학사 일반 규정 (선발 방법, 자격요건, 운영지침 등). search_scholarship_rules로 PDF 규정을 검색하세요.
        - "공지 알려줘", "선발기간", "신청기간", "마감", "2026", "언제" 등이 포함되면 → search_notices를 먼저 사용하세요. 실제 공지의 제목, 요약, 일정(시작/마감)을 답변에 포함하세요.
        - "기간이 언제야?", "2026년 선발" 등 구체적 시기 질문 → search_notices("근로장학생 2026") 등으로 검색하고, 검색 결과의 "일정" 필드(시작일/마감일)를 그대로 답변하세요.
        
        [축약어·동의어 인식]
        - "근장", "근로" → "근로장학생"으로 검색
        - "성적장학", "나눔장학" → "성적장학금", "나눔장학금"으로 검색
        - "공지 있어?" → "근로장학생", "공지" 등으로 검색
        제공된 키워드로 반드시 검색하세요.
        
        [작업 원칙]
        1. "공지", "선발기간", "신청기간", "마감", "2026" 등 → search_notices 먼저 사용. 검색 결과의 제목, 요약, 일정(시작/마감)을 답변에 반드시 포함.
        2. 일반 규정(선발방법, 자격 등) → search_scholarship_rules 사용.
        3. "기간이 언제야?" 등 시기 질문 → search_notices로 공지 검색 후, 검색 결과의 "일정" 필드를 그대로 제시. 없으면 "해당 공지에 일정 정보가 없습니다"라고 하고 학생복지팀 문의 안내.
        4. 검색된 공지가 있으면 제목과 일정을 **볼드**로 강조하여 답변하세요.
        5. search_notices 결과가 "검색된 공지사항이 없습니다"이면, search_scholarship_rules로 일반 규정을 검색해 보완하세요.
        
        [답변 포맷 - 마크다운]
        - 중요한 부분은 **볼드**로 강조하세요. 예: **마감일: 3월 15일**, **지원금액: 100만원**
        - 금액, 기간, 자격요건, 신청방법, 마감일 등 핵심 정보는 반드시 **볼드** 처리하세요.
        - 항목이 여러 개일 때는 줄바꿈과 "- "로 구분하여 가독성 있게 작성하세요.
        
        [질문 유형별 검색]
        - "근로 공지 있어?", "근장 공지 있어?" → "근로장학생", "근로장학생 선발", "근로장학생 운영" 등으로 검색
        - 장학금: "장학금" + 구체적 종류 (근로장학생, 나눔장학금, 성적장학금 등)
        - 학사: "휴학", "졸업", "부전공" 등 구체적 규정명
        - 일정: "기간", "마감", "신청기간" + 항목명
        
        [답변 예시 - search_notices 결과가 있는 경우 ("2026 근로장학생 선발기간")]
        "2026년 근로장학생 선발 관련 공지를 찾았습니다.
        
        - **[국가근로] 2026-1 국가근로장학생 모집 안내**
          **신청기간**: 2026.02.03(화) ~ 02.05(목) (시간 엄수)
          **면접기간**: ~ 02.11(수) 중 지원 부서별 개별 연락
        
        자세한 내용은 공지 원문을 확인하시거나 **학생복지팀(031-379-0049)**으로 문의해 주세요."
        
        [답변 예시 - search_scholarship_rules만 있는 경우 (일반 규정)]
        "근로장학생(근로) 관련 안내입니다.
        - **선발**: 주임교수가 선발하며, 대학행정팀에서 감독합니다.
        - **지원방법**: 희망 부서를 지원할 수 있으며, 해당 부서에서 선발합니다.
        최신 모집 일정은 **학생복지팀(031-379-0049)**으로 문의해 주세요."
        
        (검색 결과가 전혀 없는 경우에만)
        "해당 정보를 찾지 못했습니다. 학생복지팀(031-379-0049)으로 문의해 주세요."
        """
        
        logger.info("✅ [Init] 에이전트 준비 완료")

    def _expand_query(self, query: str) -> Tuple[str, List[str]]:
        """
        사용자 질문의 축약어·동의어를 정식 키워드로 확장합니다.
        예: "근장 공지 있어?" → ("근로장학생 공지 있어?", ["근로장학생", "공지"])
        Returns: (확장된 질문, 검색에 사용할 확장 키워드 목록)
        """
        expanded_keywords = []
        expanded_query = query

        for colloquial, formal in QUERY_SYNONYMS.items():
            if colloquial in query:
                expanded_query = expanded_query.replace(colloquial, formal)
                if formal not in expanded_keywords:
                    expanded_keywords.append(formal)

        # 확장된 키워드가 있으면 로그
        if expanded_keywords:
            logger.info(f"📝 [Query 확장] '{query}' → 키워드 추가: {expanded_keywords}")

        return expanded_query, expanded_keywords

    def _get_cache_key(self, query: str) -> str:
        """질문을 캐시 키로 변환 (공백 제거, 소문자 변환)"""
        normalized = query.strip().lower().replace(" ", "")
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _classify_query_type(self, query: str) -> str:
        """질문 유형을 분류합니다 (Role 기반 접근)"""
        query_lower = query.lower()
        
        # 역할별 키워드 매핑 (축약어·동의어 포함: 근장, 근로 → 근로장학생 등)
        role_keywords = {
            "scholarship": ["장학금", "장학", "성적장학금", "나눔장학금", "입학장학금", "근로장학생", "근장", "근로", "신청", "지원", "선발", "금액", "지급"],
            "academic": ["학사", "졸업", "휴학", "복학", "전과", "부전공", "복수전공", "복전", "이수", "학점", "규정"],
            "schedule": ["일정", "기간", "마감", "신청기간", "접수", "시험", "등록", "시작", "종료"],
            "notice": ["공지", "안내", "알림", "공고", "발표", "모집"]
        }
        
        # 역할별 점수 계산
        role_scores = {}
        for role, keywords in role_keywords.items():
            score = sum(1 for keyword in keywords if keyword in query_lower)
            role_scores[role] = score
        
        # 가장 높은 점수의 역할 선택
        if role_scores:
            best_role = max(role_scores.items(), key=lambda x: x[1])[0]
            if role_scores[best_role] > 0:
                return best_role
        
        return "general"  # 기본값
    
    def _extract_keywords(self, query: str) -> list:
        """질문에서 핵심 키워드를 추출합니다 (Role 기반 최적화)"""
        # 질문 유형 분류
        query_type = self._classify_query_type(query)
        
        # 역할별 최적화된 키워드 전략
        role_strategies = {
            "scholarship": {
                "base": ["장학금", "근로장학생", "신청", "자격", "기준", "금액", "지급", "종류"],
                "focus": "장학금 종류와 신청 조건 (근로장학생, 나눔장학금, 성적장학금 등)"
            },
            "academic": {
                "base": ["학사", "규정", "절차", "요건", "조건"],
                "focus": "학사 규정과 절차"
            },
            "schedule": {
                "base": ["기간", "일정", "마감", "시작", "종료"],
                "focus": "일정과 기간"
            },
            "notice": {
                "base": ["공지", "안내", "공고"],
                "focus": "공지사항"
            },
            "general": {
                "base": [],
                "focus": "일반 규정"
            }
        }
        
        strategy = role_strategies.get(query_type, role_strategies["general"])
        base_keywords = strategy["base"]
        
        # 질문에서 키워드 추출
        keywords = []
        query_lower = query.lower()
        
        # 역할별 기본 키워드 중 질문에 포함된 것 추가
        for keyword in base_keywords:
            if keyword in query_lower:
                keywords.append(keyword)
        
        # 질문에서 핵심 단어 추출
        import re
        sentences = re.split(r'[?.,!]\s*', query)
        stop_words = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '로', '와', '과', '도', '만', '부터', '까지', '에게', '한테', '을까', '을까요', '인가요', '인가', '어떻게', '무엇', '언제']
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 2:
                words = sentence.split()
                for word in words:
                    word_clean = word.strip('.,!?')
                    if len(word_clean) > 1 and word_clean not in stop_words:
                        keywords.append(word_clean)
        
        # 중복 제거 및 원본 질문 추가
        keywords = list(set(keywords))
        keywords.insert(0, query)  # 원본 질문을 첫 번째로
        
        # 역할별 기본 키워드도 추가 (질문에 없어도)
        if query_type != "general":
            keywords.extend([k for k in base_keywords[:3] if k not in keywords])
        
        logger.info(f"🎭 [Query Type] {query_type} / 키워드: {keywords[:4]}")
        
        return keywords[:8]  # 최대 8개 (동의어·확장 검색 대비)
    
    def ask(self, query: str) -> str:
        if not query.strip():
            return "질문을 입력해주세요."

        logger.info("\n" + "="*60)
        logger.info(f"🎯 [질문] {query}")
        
        # 캐시 확인
        cache_key = self._get_cache_key(query)
        if cache_key in self.cache:
            logger.info("⚡ [Cache] 캐시에서 답변을 찾았습니다!")
            return self.cache[cache_key]
        
        # 1. 축약어·동의어 확장 (근장→근로장학생 등)
        expanded_query, expanded_keywords = self._expand_query(query)
        
        # 2. 키워드 추출 (확장된 질문 기준)
        keywords = self._extract_keywords(expanded_query)
        
        # 3. 확장 키워드를 검색 우선순위로 앞에 추가
        for ek in reversed(expanded_keywords):
            if ek not in keywords:
                keywords.insert(1, ek)  # 원본 질문 다음에 배치
        keywords = keywords[:8]  # 최대 8개로 확대 (동의어 검색 대비)
        
        logger.info(f"🔑 [키워드] 추출된 키워드: {keywords[:5]}")
        
        # 대화 기록 초기화 (시스템 메시지 + 사용자 질문)
        keyword_hint = ", ".join(keywords[:5])
        notice_hint = ""
        if any(w in query for w in ["공지", "선발기간", "신청기간", "마감", "2026", "언제", "일정"]):
            notice_hint = "\n\n[중요] 이 질문은 실제 공지사항(선발기간, 일정 등)을 묻는 것이므로, 반드시 search_notices 도구를 먼저 사용하세요. search_notices에 키워드를 전달하세요 (예: 근로장학생, 2026)."
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=f"질문: {query}\n\n이 질문에 답하기 위해 다음 키워드들로 검색하세요 (축약어는 정식 용어로 치환): {keyword_hint}{notice_hint}")
        ]
        
        start_time = datetime.now()
        
        # === 루프 시작 (최대 8회 반복, 복잡한 질문 처리) ===
        search_attempts = 0
        max_search_attempts = 5  # 검색은 최대 5회 (복잡한 질문 대비)
        
        for i in range(8):  # 복잡한 질문을 위해 루프 횟수 증가
            logger.info(f"🔄 [Step {i+1}] LLM 추론 중...")
            
            try:
                # 1. LLM 호출
                ai_msg = self.llm_with_tools.invoke(messages)
            except Exception as e:
                logger.error(f"❌ [Step {i+1}] LLM 호출 실패: {str(e)}")
                if i == 0:
                    # 첫 시도 실패 시 재시도
                    continue
                else:
                    # 여러 번 실패 시 에러 반환
                    return f"죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요. (오류: {str(e)})"
            
            # 메시지 기록에 AI 응답 추가
            messages.append(ai_msg)

            # 2. 도구 호출 여부 확인
            if ai_msg.tool_calls:
                search_attempts += 1
                
                # 검색 시도 횟수 제한
                if search_attempts > max_search_attempts:
                    logger.warning(f"⚠️ 검색 시도 횟수 초과 ({max_search_attempts}회)")
                    # 마지막 검색 결과로 답변 생성 시도
                    break
                
                # LLM이 도구를 쓰겠다고 판단함
                # 중요: tool_calls 직후에는 반드시 ToolMessage가 와야 함 (HumanMessage 먼저 추가 시 API 오류)
                need_retry_hint = False
                retry_keyword = None
                retry_final_hint = False

                for tool_call in ai_msg.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]
                    
                    logger.info(f"🛠️  [도구 실행] {tool_name} / 인자: {tool_args}")
                    
                    # 도구 실행
                    try:
                        if tool_name == "search_scholarship_rules":
                            tool_output = search_scholarship_rules.invoke(tool_args)
                            output_str = str(tool_output)
                            if "검색 결과가 없습니다" in output_str or len(output_str) < 50:
                                if search_attempts < len(keywords) and search_attempts < max_search_attempts:
                                    need_retry_hint = True
                                    retry_keyword = keywords[search_attempts] if search_attempts < len(keywords) else keywords[-1]
                                else:
                                    retry_final_hint = True
                        elif tool_name == "search_notices":
                            tool_output = search_notices.invoke(tool_args)
                            output_str = str(tool_output)
                        elif tool_name == "get_recent_notices":
                            tool_output = get_recent_notices.invoke(tool_args)
                            output_str = str(tool_output)
                        elif tool_name == "search_notices_by_deadline":
                            tool_output = search_notices_by_deadline.invoke(tool_args)
                            output_str = str(tool_output)
                        else:
                            output_str = f"알 수 없는 도구: {tool_name}"
                        logger.info(f"📄 [도구 결과] {len(output_str)}자")
                        messages.append(ToolMessage(content=output_str, tool_call_id=tool_id))
                    except Exception as e:
                        logger.error(f"❌ 도구 실행 실패: {str(e)}")
                        messages.append(ToolMessage(
                            content=f"검색 중 오류가 발생했습니다: {str(e)}",
                            tool_call_id=tool_id
                        ))
                
                # ToolMessage 모두 추가한 후, 재검색 힌트 추가
                if need_retry_hint and retry_keyword:
                    logger.info(f"🔄 [재검색] 키워드 '{retry_keyword}'로 재검색 시도")
                    messages.append(HumanMessage(
                        content=f"이전 검색 결과가 부족했습니다. '{retry_keyword}' 키워드로 다시 검색해주세요."
                    ))
                elif retry_final_hint:
                    messages.append(HumanMessage(
                        content="검색 결과가 부족하지만, 기존 검색 결과와 일반적인 지식을 바탕으로 최선을 다해 답변해주세요."
                    ))
            else:
                # 도구 호출이 없으면 최종 답변으로 간주하고 루프 종료
                logger.info("✅ 최종 답변 생성 완료")
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(f"⏱️  소요 시간: {elapsed:.2f}초")
                
                # 캐시에 저장
                answer = ai_msg.content
                if len(self.cache) >= self.cache_size:
                    # 가장 오래된 항목 제거 (FIFO)
                    oldest_key = next(iter(self.cache))
                    del self.cache[oldest_key]
                self.cache[cache_key] = answer
                
                logger.info("="*60 + "\n")
                return answer

        # 루프 종료 후 마지막 시도로 답변 생성
        logger.info("🔄 [Final] 최종 답변 생성 시도...")
        final_msg = self.llm.invoke(messages)
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"⏱️  소요 시간: {elapsed:.2f}초")
        
        if final_msg.content:
            answer = final_msg.content
            # 캐시에 저장
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