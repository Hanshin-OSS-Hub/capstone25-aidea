"""
AI 기능 단위 테스트 스크립트
실행: python test_ai.py
venv 활성화 후 backend/ 디렉토리에서 실행할 것
"""

import asyncio
import os
import sys

# .env 로드
from dotenv import load_dotenv
load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# 색상 출력 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}[OK]{RESET} {msg}")
def fail(msg):  print(f"  {RED}[FAIL]{RESET} {msg}")
def warn(msg):  print(f"  {YELLOW}[!]{RESET} {msg}")
def info(msg):  print(f"  {CYAN}-->{RESET} {msg}")
def header(msg):print(f"\n{BOLD}{CYAN}{'='*55}{RESET}\n{BOLD} {msg}{RESET}\n{BOLD}{CYAN}{'='*55}{RESET}")
def section(msg):print(f"\n{BOLD}[{msg}]{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. 환경 변수 확인
# ─────────────────────────────────────────────────────────────────────────────

async def test_env():
    section("1. 환경 변수 확인")
    from core.config import settings

    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "":
        ok(f"OPENAI_API_KEY 설정됨 (sk-...{settings.OPENAI_API_KEY[-6:]})")
    else:
        fail("OPENAI_API_KEY 없음 → 모든 AI 기능 불가")

    info(f"OPENAI_LLM_MODEL: {settings.OPENAI_LLM_MODEL}")
    info(f"OPENAI_EMBEDDING_MODEL: {settings.OPENAI_EMBEDDING_MODEL}")

    if settings.DATABASE_URL:
        ok(f"DATABASE_URL 설정됨")
    else:
        fail("DATABASE_URL 없음")

    if settings.REDIS_URL:
        ok(f"REDIS_URL: {settings.REDIS_URL}")
    else:
        warn("REDIS_URL 없음 → 캐시 비활성화")


# ─────────────────────────────────────────────────────────────────────────────
# 2. OpenAI API 연결
# ─────────────────────────────────────────────────────────────────────────────

async def test_openai():
    section("2. OpenAI API 연결")
    from core.config import settings
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY.strip())

    # 임베딩 모델 테스트
    try:
        resp = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input="테스트",
        )
        dim = len(resp.data[0].embedding)
        ok(f"임베딩 모델 ({settings.OPENAI_EMBEDDING_MODEL}) 정상 — 벡터 차원: {dim}")
    except Exception as e:
        fail(f"임베딩 모델 오류: {e}")

    # LLM 테스트
    try:
        resp = await client.chat.completions.create(
            model=settings.OPENAI_LLM_MODEL,
            messages=[{"role": "user", "content": "안녕"}],
            max_tokens=10,
        )
        ok(f"LLM ({settings.OPENAI_LLM_MODEL}) 정상 — 응답: '{resp.choices[0].message.content}'")
    except Exception as e:
        fail(f"LLM 오류: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 3. DB 연결 + 데이터 현황
# ─────────────────────────────────────────────────────────────────────────────

async def test_db():
    section("3. DB 연결 + 데이터 현황")
    from core.database import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as session:
        # 기본 연결
        try:
            await session.execute(text("SELECT 1"))
            ok("DB 연결 정상")
        except Exception as e:
            fail(f"DB 연결 실패: {e}")
            return

        # 테이블별 레코드 수
        tables = [
            ("users",          "유저"),
            ("notices",        "공지"),
            ("chat_sessions",  "챗 세션"),
            ("chat_messages",  "챗 메시지"),
            ("qa_documents",   "QA 문서"),
        ]
        for table, label in tables:
            try:
                row = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                cnt = row.scalar()
                if cnt and cnt > 0:
                    ok(f"{label}({table}): {cnt}개")
                else:
                    warn(f"{label}({table}): 0개 — 데이터 없음")
            except Exception as e:
                fail(f"{table} 조회 실패: {e}")

        # notices 임베딩 현황
        try:
            row = await session.execute(text(
                "SELECT COUNT(*) FROM notices WHERE embedding IS NOT NULL"
            ))
            embedded = row.scalar() or 0
            row2 = await session.execute(text("SELECT COUNT(*) FROM notices"))
            total = row2.scalar() or 0
            if embedded > 0:
                ok(f"notices 임베딩: {embedded}/{total}개 완료")
            else:
                warn(f"notices 임베딩: 0/{total}개 — answer_faq 공지 검색 불가")
        except Exception as e:
            fail(f"notices 임베딩 확인 실패: {e}")

        # qa_documents 임베딩 현황
        try:
            row = await session.execute(text(
                "SELECT COUNT(*) FROM qa_documents WHERE embedding IS NOT NULL"
            ))
            embedded = row.scalar() or 0
            if embedded > 0:
                ok(f"qa_documents 임베딩: {embedded}개 완료")
            else:
                warn(f"qa_documents 임베딩: 0개 — answer_faq FAQ 검색 불가")
        except Exception as e:
            fail(f"qa_documents 확인 실패: {e}")

        # notices summary 현황
        try:
            row = await session.execute(text(
                "SELECT COUNT(*) FROM notices WHERE summary IS NOT NULL AND summary != ''"
            ))
            with_summary = row.scalar() or 0
            row2 = await session.execute(text("SELECT COUNT(*) FROM notices"))
            total = row2.scalar() or 0
            if with_summary > 0:
                ok(f"notices AI 요약: {with_summary}/{total}개 완료")
            else:
                warn(f"notices AI 요약: 0/{total}개 — 공지 상세화면에서 요약 미표시")
        except Exception as e:
            fail(f"notices summary 확인 실패: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 4. fetch_notices 툴
# ─────────────────────────────────────────────────────────────────────────────

async def test_tool_fetch_notices():
    section("4. [챗봇 툴] fetch_notices — 공지 키워드 검색")
    try:
        from ai.tools.fetch_notices import fetch_notices
        result = await fetch_notices.ainvoke({"query": "장학금"})
        if "검색된 공지사항이 없습니다" in result:
            warn(f"결과 없음: DB에 장학금 관련 공지 없음")
            info("→ 크롤러를 먼저 실행하거나 공지 데이터를 넣어주세요")
        else:
            ok(f"정상 응답 (일부):\n    {result[:200].replace(chr(10), chr(10)+'    ')}")
    except Exception as e:
        fail(f"fetch_notices 오류: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. search_by_deadline 툴
# ─────────────────────────────────────────────────────────────────────────────

async def test_tool_search_by_deadline():
    section("5. [챗봇 툴] search_by_deadline — 최근 공지 조회")
    try:
        from ai.tools.search_by_deadline import search_by_deadline
        result = await search_by_deadline.ainvoke({"days_ahead": 30})
        if "공지사항이 없습니다" in result:
            warn("최근 30일 이내 공지 없음 (크롤러 미실행 또는 데이터 없음)")
        else:
            ok(f"정상 응답 (일부):\n    {result[:200].replace(chr(10), chr(10)+'    ')}")
    except Exception as e:
        fail(f"search_by_deadline 오류: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 6. answer_faq 툴 (벡터 검색)
# ─────────────────────────────────────────────────────────────────────────────

async def test_tool_answer_faq():
    section("6. [챗봇 툴] answer_faq — 벡터 유사도 검색")
    try:
        from ai.tools.answer_faq import answer_faq
        result = await answer_faq.ainvoke({"query": "장학금 신청 자격"})
        if "관련 정보를 찾을 수 없습니다" in result:
            warn("유사도 >= 0.75 결과 없음")
            warn("→ notices.embedding 또는 qa_documents 데이터 필요")
        else:
            ok(f"정상 응답 (일부):\n    {result[:200].replace(chr(10), chr(10)+'    ')}")
    except Exception as e:
        fail(f"answer_faq 오류: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 7. 챗봇 에이전트 전체 플로우
# ─────────────────────────────────────────────────────────────────────────────

async def test_chat_agent():
    section("7. 챗봇 에이전트 전체 플로우 (ScholarshipAgent.ask)")
    try:
        from ai.agent import get_agent
        agent = get_agent()
        ok("ScholarshipAgent 초기화 성공")

        query = "장학금 신청 방법 알려줘"
        info(f"질문: '{query}'")
        answer = await agent.ask(query)

        if answer and len(answer) > 10:
            ok(f"응답 수신 완료 ({len(answer)}자)")
            info(f"응답 일부: {answer[:200]}...")
        else:
            warn(f"응답이 너무 짧거나 비어있음: '{answer}'")
    except Exception as e:
        fail(f"챗봇 에이전트 오류: {type(e).__name__}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 8. 공지 AI 요약
# ─────────────────────────────────────────────────────────────────────────────

async def test_notice_summary():
    section("8. 공지 AI 요약 (GET /api/v1/notices/{id}/summary)")
    from core.database import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as session:
        # summary가 있는 공지 하나 찾기
        row = await session.execute(text(
            "SELECT id, title, summary FROM notices "
            "WHERE summary IS NOT NULL AND summary != '' LIMIT 1"
        ))
        notice = row.first()

        if not notice:
            warn("summary가 있는 공지 없음")
            info("→ 크롤러 실행 시 summary 자동 생성 여부 확인 필요")

            # summary 없는 공지로 엔드포인트 응답 확인
            row2 = await session.execute(text("SELECT id, title FROM notices LIMIT 1"))
            any_notice = row2.first()
            if any_notice:
                info(f"테스트 공지: '{any_notice.title[:50]}'")
                info(f"→ GET /api/v1/notices/{any_notice.id}/summary 호출 시 summary: null 반환됨")
            else:
                warn("notices 테이블에 공지 자체가 없음")
        else:
            ok(f"summary 있는 공지 발견: '{notice.title[:50]}'")
            info(f"요약 일부: {notice.summary[:150]}...")


# ─────────────────────────────────────────────────────────────────────────────
# 9. 일일 브리핑
# ─────────────────────────────────────────────────────────────────────────────

async def test_daily_summary():
    section("9. 일일 브리핑 (chat_service.get_daily_summary)")
    from core.database import AsyncSessionLocal
    from sqlalchemy import text
    import uuid

    # 테스트용 user_id (실제 존재하는 유저 사용)
    async with AsyncSessionLocal() as session:
        row = await session.execute(text("SELECT id FROM users LIMIT 1"))
        user = row.first()

    if not user:
        warn("users 테이블에 유저 없음 → 브리핑 테스트 불가")
        return

    user_id = user.id
    info(f"테스트 유저 ID: {user_id}")

    try:
        from services.chat_service import get_daily_summary
        async with AsyncSessionLocal() as session:
            summary = await get_daily_summary(session, user_id)
        if summary and len(summary) > 10:
            ok(f"일일 브리핑 생성 완료 ({len(summary)}자)")
            info(f"내용: {summary}")
        else:
            warn(f"브리핑이 짧거나 비어있음: '{summary}'")
    except Exception as e:
        fail(f"일일 브리핑 오류: {type(e).__name__}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 10. SSE 스트리밍 응답 형식 확인
# ─────────────────────────────────────────────────────────────────────────────

async def test_sse_format():
    section("10. SSE 스트리밍 형식 확인 (ask_stream)")
    try:
        import json
        from ai.agent import get_agent
        agent = get_agent()

        chunks = []
        async for chunk in agent.ask_stream("안녕"):
            chunks.append(chunk)

        if len(chunks) >= 2:
            ok(f"SSE 청크 수: {len(chunks)}개")
            for i, c in enumerate(chunks):
                parsed = json.loads(c)
                info(f"청크 {i+1}: type='{parsed['type']}'" +
                     (f", content 길이={len(parsed.get('content',''))}자" if 'content' in parsed else ""))
        else:
            warn(f"청크 수 부족: {len(chunks)}개")
    except Exception as e:
        fail(f"SSE 스트리밍 오류: {type(e).__name__}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    header("UniMate AI 기능 단위 테스트")

    tests = [
        ("환경 변수",           test_env),
        ("OpenAI API",          test_openai),
        ("DB 연결/데이터",       test_db),
        ("fetch_notices 툴",    test_tool_fetch_notices),
        ("search_by_deadline",  test_tool_search_by_deadline),
        ("answer_faq (벡터)",   test_tool_answer_faq),
        ("챗봇 에이전트",        test_chat_agent),
        ("공지 AI 요약",         test_notice_summary),
        ("일일 브리핑",          test_daily_summary),
        ("SSE 형식",            test_sse_format),
    ]

    failed = []
    for name, fn in tests:
        try:
            await fn()
        except Exception as e:
            fail(f"테스트 '{name}' 예외 발생: {e}")
            failed.append(name)

    print(f"\n{BOLD}{CYAN}{'='*55}{RESET}")
    if failed:
        print(f"{BOLD}{RED} 실패한 테스트: {', '.join(failed)}{RESET}")
    else:
        print(f"{BOLD}{GREEN} 모든 테스트 완료{RESET}")
    print(f"{BOLD}{CYAN}{'='*55}{RESET}\n")


if __name__ == "__main__":
    # Windows 콘솔 UTF-8 출력 설정
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    # backend/ 디렉토리를 sys.path에 추가
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    asyncio.run(main())
