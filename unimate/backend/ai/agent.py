import json
import re
import logging
import hashlib
import time
from typing import AsyncGenerator

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from core.config import settings

logger = logging.getLogger(__name__)
ai_logger = logging.getLogger("ai")

QUERY_SYNONYMS = {
    "근장": "근로장학생", "근로": "근로장학생", "근로장학": "근로장학생",
    "성적장학": "성적장학금", "나눔장학": "나눔장학금", "입학장학": "입학장학금",
    "국장": "국비장학금", "국비": "국비장학금",
    "등록장학": "등록장학금", "교내장학": "교내장학금", "교외장학": "교외장학금",
    "복전": "복수전공",
}


class ScholarshipAgent:

    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.OPENAI_LLM_MODEL,
            temperature=0,
            max_tokens=3000,
            openai_api_key=settings.OPENAI_API_KEY.strip(),
        )

        from ai.tools.fetch_notices import fetch_notices
        from ai.tools.search_by_deadline import search_by_deadline
        from ai.tools.answer_faq import answer_faq

        self.tools = [fetch_notices, search_by_deadline, answer_faq]
        self.tool_map = {t.name: t for t in self.tools}
        self.llm_with_tools = self.llm.bind_tools(self.tools)

        self._memory_cache: dict[str, str] = {}

        self.system_prompt = (
            "당신은 한신대학교 장학금 및 학사 규정 전문가 '한신봇'입니다.\n\n"
            "[핵심: 공지 vs 규정 구분]\n"
            "- **공지** = 학교에서 올린 실제 공고/안내문. "
            "반드시 fetch_notices로 DB 공지사항을 검색하세요.\n"
            "- **규정** = 장학금/학사 일반 규정. "
            "answer_faq로 PDF 규정과 공지 임베딩을 동시 검색하세요.\n\n"
            "[작업 원칙]\n"
            '1. "공지", "선발기간", "신청기간", "마감" 등 → fetch_notices 먼저 사용\n'
            '2. "마감 임박", "이번 주 공지" → search_by_deadline 사용\n'
            "3. 일반 규정(선발방법, 자격 등) → answer_faq 사용\n"
            "4. 검색 결과 없으면 다른 도구로 보완 검색\n"
            "5. 중요 정보는 **볼드**로 강조\n"
            "6. 정보를 찾지 못하면 학생복지팀(031-379-0049) 문의 안내"
        )

    # ── 질문 전처리 ─────────────────────────────────────────

    def _expand_query(self, query: str) -> tuple[str, list[str]]:
        expanded_keywords: list[str] = []
        expanded_query = query
        for colloquial, formal in QUERY_SYNONYMS.items():
            if colloquial in query:
                expanded_query = expanded_query.replace(colloquial, formal)
                if formal not in expanded_keywords:
                    expanded_keywords.append(formal)
        return expanded_query, expanded_keywords

    def _get_cache_key(self, query: str) -> str:
        normalized = query.strip().lower().replace(" ", "")
        return hashlib.md5(normalized.encode()).hexdigest()

    def _classify_query_type(self, query: str) -> str:
        q = query.lower()
        role_keywords = {
            "scholarship": ["장학금", "장학", "성적장학금", "나눔장학금", "근로장학생",
                            "신청", "지원", "선발", "금액"],
            "academic":    ["학사", "졸업", "휴학", "복학", "전과", "부전공",
                            "복수전공", "이수", "학점", "규정"],
            "schedule":    ["일정", "기간", "마감", "신청기간", "접수", "시험", "등록"],
            "notice":      ["공지", "안내", "알림", "공고", "발표", "모집"],
        }
        scores = {
            role: sum(1 for kw in kws if kw in q)
            for role, kws in role_keywords.items()
        }
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "general"

    def _extract_keywords(self, query: str) -> list[str]:
        query_type = self._classify_query_type(query)
        base_map = {
            "scholarship": ["장학금", "근로장학생", "신청", "자격", "금액"],
            "academic":    ["학사", "규정", "절차", "요건"],
            "schedule":    ["기간", "일정", "마감"],
            "notice":      ["공지", "안내", "공고"],
            "general":     [],
        }
        base = base_map.get(query_type, [])
        stop_words = {
            "은", "는", "이", "가", "을", "를", "의", "에", "에서",
            "으로", "로", "와", "과", "도", "만", "부터", "까지",
            "어떻게", "무엇", "언제", "인가요",
        }
        keywords = [kw for kw in base if kw in query.lower()]
        for sentence in re.split(r"[?.,!]\s*", query):
            for word in sentence.strip().split():
                w = word.strip(".,!?")
                if len(w) > 1 and w not in stop_words:
                    keywords.append(w)
        keywords = list(dict.fromkeys(keywords))
        keywords.insert(0, query)
        return keywords[:8]

    # ── 캐시 ────────────────────────────────────────────────

    async def _get_cached(self, key: str) -> str | None:
        try:
            from core.redis import get_redis_pool
            redis = get_redis_pool()
            cached = await redis.get(f"chat:cache:{key}")
            if cached:
                return cached
        except Exception:
            pass
        return self._memory_cache.get(key)

    async def _set_cache(self, key: str, value: str) -> None:
        try:
            from core.redis import get_redis_pool
            redis = get_redis_pool()
            await redis.set(f"chat:cache:{key}", value, ex=3600)
        except Exception:
            pass
        self._memory_cache[key] = value
        if len(self._memory_cache) > 100:
            oldest = next(iter(self._memory_cache))
            del self._memory_cache[oldest]

    # ── 도구 실행 ───────────────────────────────────────────

    async def _execute_tool(self, tool_call: dict) -> str:
        name = tool_call["name"]
        args = tool_call["args"]
        logger.info(f"[도구 실행] {name} / 인자: {args}")
        tool_fn = self.tool_map.get(name)
        if not tool_fn:
            return f"알 수 없는 도구: {name}"
        try:
            t = time.monotonic()
            result = await tool_fn.ainvoke(args)
            elapsed = round((time.monotonic() - t) * 1000)
            result_str = str(result)
            ai_logger.debug(f"  [TOOL] {name} → {elapsed}ms | 결과 {len(result_str)}자")
            return result_str
        except Exception as e:
            logger.error(f"도구 실행 실패 ({name}): {e}")
            return f"검색 중 오류: {e}"

    # ── 핵심 질의 ───────────────────────────────────────────

    async def ask(self, query: str) -> str:
        if not query.strip():
            return "질문을 입력해주세요."

        total_start = time.monotonic()
        logger.info(f"[질문] {query}")
        ai_logger.info(f"━━ 질문 시작: {query[:60]}")

        # ── 캐시 확인 ──────────────────────────────────────────
        t = time.monotonic()
        cache_key = self._get_cache_key(query)
        cached = await self._get_cached(cache_key)
        cache_ms = round((time.monotonic() - t) * 1000)

        if cached:
            ai_logger.info(f"  [CACHE HIT] {cache_ms}ms → 총 {cache_ms}ms")
            return cached

        ai_logger.debug(f"  [CACHE MISS] {cache_ms}ms")

        expanded_query, expanded_keywords = self._expand_query(query)
        keywords = self._extract_keywords(expanded_query)
        for ek in reversed(expanded_keywords):
            if ek not in keywords:
                keywords.insert(1, ek)
        keywords = keywords[:8]

        keyword_hint = ", ".join(keywords[:5])
        notice_hint = ""
        if any(w in query for w in ["공지", "선발기간", "신청기간", "마감", "2026", "언제", "일정"]):
            notice_hint = (
                "\n\n[중요] 이 질문은 실제 공지사항을 묻는 것이므로, "
                "반드시 fetch_notices 도구를 먼저 사용하세요."
            )

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=f"질문: {query}\n\n검색 키워드: {keyword_hint}{notice_hint}"),
        ]

        search_attempts = 0
        max_search = 5
        llm_call_count = 0
        tool_call_count = 0

        for _ in range(8):
            try:
                t = time.monotonic()
                ai_msg = await self.llm_with_tools.ainvoke(messages)
                llm_ms = round((time.monotonic() - t) * 1000)
                llm_call_count += 1
                ai_logger.debug(f"  [LLM #{llm_call_count}] {llm_ms}ms | tool_calls={len(ai_msg.tool_calls)}")
            except Exception as e:
                logger.error(f"LLM 호출 실패: {e}")
                return "AI 서비스에 문제가 발생했습니다. 잠시 후 다시 시도해주세요."

            messages.append(ai_msg)

            if ai_msg.tool_calls:
                search_attempts += 1
                tool_call_count += len(ai_msg.tool_calls)
                if search_attempts > max_search:
                    break

                need_retry = False
                retry_keyword = None

                for tc in ai_msg.tool_calls:
                    output = await self._execute_tool(tc)
                    if "검색 결과가 없습니다" in output or len(output) < 50:
                        if search_attempts < len(keywords) and search_attempts < max_search:
                            need_retry = True
                            retry_keyword = keywords[min(search_attempts, len(keywords) - 1)]
                    messages.append(ToolMessage(content=output, tool_call_id=tc["id"]))

                if need_retry and retry_keyword:
                    messages.append(HumanMessage(
                        content=f"이전 검색 결과가 부족합니다. '{retry_keyword}' 키워드로 다시 검색해주세요."
                    ))
            else:
                answer = ai_msg.content or ""
                await self._set_cache(cache_key, answer)
                total_ms = round((time.monotonic() - total_start) * 1000)
                ai_logger.info(
                    f"  [완료] LLM {llm_call_count}회 | 도구 {tool_call_count}회 | 총 {total_ms}ms"
                )
                return answer

        t = time.monotonic()
        final = await self.llm.ainvoke(messages)
        llm_ms = round((time.monotonic() - t) * 1000)
        llm_call_count += 1
        answer = final.content or (
            "규정을 찾는 데 시간이 너무 오래 걸렸습니다. "
            "학생복지팀(031-379-0049)으로 문의해주세요."
        )
        await self._set_cache(cache_key, answer)
        total_ms = round((time.monotonic() - total_start) * 1000)
        ai_logger.info(
            f"  [완료-fallback] LLM {llm_call_count}회 | 도구 {tool_call_count}회 | 총 {total_ms}ms"
        )
        return answer

    async def ask_stream(self, query: str) -> AsyncGenerator[str, None]:
        answer = await self.ask(query)
        yield json.dumps({"type": "token", "content": answer}, ensure_ascii=False)
        yield json.dumps({"type": "done"}, ensure_ascii=False)


_agent_instance: ScholarshipAgent | None = None


def get_agent() -> ScholarshipAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = ScholarshipAgent()
    return _agent_instance
