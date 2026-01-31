# backend/agent/agent.py

import os
import sys
import logging
from datetime import datetime
from functools import lru_cache
import hashlib

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
        
        # 2. 도구 바인딩 (이게 핵심!)
        # LLM에게 "너는 이 도구를 쓸 수 있어"라고 알려주는 최신 방식
        self.tools = [search_scholarship_rules]
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        
        # 3. 응답 캐시 (같은 질문에 대한 빠른 응답)
        self.cache = {}
        self.cache_size = cache_size
        
        # 3. 시스템 프롬프트 설정 (Few-shot 예시 포함, 복잡한 질문 처리 강화)
        self.system_prompt = """
        당신은 한신대학교 장학금 및 학사 규정 전문가 '한신봇'입니다.
        
        [작업 원칙]
        1. 질문에 답하기 위해 반드시 제공된 도구(search_scholarship_rules)를 사용하여 규정을 확인하세요.
        2. 사용자의 질문이 여러 개의 하위 질문을 포함하는 경우(예: "A와 B는 무엇인가요?"), 각각에 대해 별도로 검색하세요.
        3. 질문이 복잡하거나 모호하면 제공된 키워드들을 활용하여 여러 번 검색을 시도하세요.
        4. 검색 결과의 유사도 점수를 확인하고, 높은 유사도의 결과를 우선적으로 사용하세요.
        5. 검색 결과가 부족하면 다른 키워드나 관련 용어로 재검색하세요.
        6. 검색된 정보가 없다면 솔직하게 없다고 말하고, 학생복지팀(031-379-0049) 문의를 안내하세요.
        7. 최종 답변은 친절하게, 핵심 정보(금액, 기간, 자격, 신청 방법) 위주로 명확하게 요약하세요.
        8. 여러 질문이 포함된 경우, 각 질문에 대해 명확하게 구분하여 답변하세요.
        9. 출처 정보를 언급하여 신뢰성을 높이세요.
        10. 검색 결과를 그대로 복사하지 말고, 사용자가 이해하기 쉽게 재구성하여 답변하세요.
        
        [질문 유형별 검색 전략]
        - 장학금 관련: "장학금" + 구체적 종류/조건으로 검색 (예: "나눔장학금 신청", "성적장학금 자격")
        - 학사 규정: 구체적 규정명으로 검색 (예: "휴학 신청", "졸업 요건")
        - 일정 관련: "기간", "일정", "마감" + 항목명으로 검색 (예: "장학금 신청 기간")
        - 공지사항: 공지 키워드 + 주제로 검색
        
        [검색 전략]
        - 첫 검색: 원본 질문 전체로 검색
        - 재검색: 핵심 키워드로 개별 검색 (질문 유형에 맞는 키워드 우선)
        - 최종 검색: 관련 용어나 동의어로 검색
        
        [복잡한 질문 처리 예시]
        질문: "장학금 신청 기간과 성적 기준을 알려주세요"
        처리 방법:
        1. "장학금 신청 기간"으로 검색
        2. "장학금 성적 기준"으로 검색
        3. 두 검색 결과를 종합하여 답변
        
        [답변 형식 예시]
        질문: "장학금 신청 기간이 언제인가요?"
        답변: "한신대학교 장학금 신청 기간은 다음과 같습니다:
        - 1학기: 매년 2월 중순 ~ 3월 초
        - 2학기: 매년 8월 중순 ~ 9월 초
        
        자세한 내용은 [장학규정.pdf] 문서를 참고하시거나, 학생복지팀(031-379-0049)으로 문의해주세요."
        """
        
        logger.info("✅ [Init] 에이전트 준비 완료")

    def _get_cache_key(self, query: str) -> str:
        """질문을 캐시 키로 변환 (공백 제거, 소문자 변환)"""
        normalized = query.strip().lower().replace(" ", "")
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _classify_query_type(self, query: str) -> str:
        """질문 유형을 분류합니다 (Role 기반 접근)"""
        query_lower = query.lower()
        
        # 역할별 키워드 매핑
        role_keywords = {
            "scholarship": ["장학금", "장학", "성적장학금", "나눔장학금", "입학장학금", "신청", "지원", "선발", "금액", "지급"],
            "academic": ["학사", "졸업", "휴학", "복학", "전과", "부전공", "복수전공", "이수", "학점", "규정"],
            "schedule": ["일정", "기간", "마감", "신청기간", "접수", "시험", "등록", "시작", "종료"],
            "notice": ["공지", "안내", "알림", "공고", "발표"]
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
                "base": ["장학금", "신청", "자격", "기준", "금액", "지급", "종류"],
                "focus": "장학금 종류와 신청 조건"
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
        
        return keywords[:6]  # 최대 6개
    
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
        
        # 키워드 추출 (검색 전략 개선)
        keywords = self._extract_keywords(query)
        logger.info(f"🔑 [키워드] 추출된 키워드: {keywords[:3]}")
        
        # 대화 기록 초기화 (시스템 메시지 + 사용자 질문)
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=f"질문: {query}\n\n이 질문에 답하기 위해 다음 키워드들을 고려해보세요: {', '.join(keywords[:3])}")
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
                for tool_call in ai_msg.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]
                    
                    logger.info(f"🛠️  [도구 실행] {tool_name} / 인자: {tool_args}")
                    
                    # 도구 실행 (여기서는 도구가 하나뿐이므로 바로 실행)
                    if tool_name == "search_scholarship_rules":
                        try:
                            # 실제 도구 함수 실행
                            tool_output = search_scholarship_rules.invoke(tool_args)
                            output_str = str(tool_output)
                            logger.info(f"📄 [검색 결과] {len(output_str)}자 확보")
                            
                            # 검색 결과 품질 체크 및 개선
                            if "검색 결과가 없습니다" in output_str or len(output_str) < 50:
                                logger.warning("⚠️ 검색 결과가 부족합니다. 다른 키워드로 재시도합니다.")
                                
                                # 추출된 키워드 중 아직 사용하지 않은 것으로 재검색
                                if search_attempts < len(keywords) and search_attempts < max_search_attempts:
                                    next_keyword = keywords[search_attempts] if search_attempts < len(keywords) else keywords[-1]
                                    logger.info(f"🔄 [재검색] 키워드 '{next_keyword}'로 재검색 시도")
                                    # 재검색을 위한 메시지 추가
                                    messages.append(HumanMessage(
                                        content=f"이전 검색 결과가 부족했습니다. '{next_keyword}' 키워드로 다시 검색해주세요."
                                    ))
                                else:
                                    # 모든 키워드를 시도했거나 결과가 없으면 답변 생성 시도
                                    messages.append(HumanMessage(
                                        content="검색 결과가 부족하지만, 기존 검색 결과와 일반적인 지식을 바탕으로 최선을 다해 답변해주세요."
                                    ))
                            
                            # 도구 결과를 메시지 기록에 추가 (ToolMessage)
                            messages.append(ToolMessage(
                                content=output_str,
                                tool_call_id=tool_id
                            ))
                        except Exception as e:
                            logger.error(f"❌ 도구 실행 실패: {str(e)}")
                            # 도구 실행 실패 시 에러 메시지를 도구 결과로 추가
                            messages.append(ToolMessage(
                                content=f"검색 중 오류가 발생했습니다: {str(e)}",
                                tool_call_id=tool_id
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