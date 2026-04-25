import json
import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from core.config import settings
from models.chat import ChatSession, ChatMessage

logger = logging.getLogger(__name__)


async def run_agent(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID | None,
    message: str,
) -> AsyncGenerator[str, None]:
    if session_id is None:
        chat_session = ChatSession(user_id=user_id, preview=message[:200])
        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)
        session_id = chat_session.id
    else:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
            )
        )
        if not result.scalar_one_or_none():
            chat_session = ChatSession(
                id=session_id, user_id=user_id, preview=message[:200]
            )
            db.add(chat_session)
            await db.commit()

    user_msg = ChatMessage(session_id=session_id, role="user", content=message)
    db.add(user_msg)
    await db.commit()

    yield (
        "data: "
        + json.dumps({"type": "session_id", "content": str(session_id)}, ensure_ascii=False)
        + "\n\n"
    )

    from ai.agent import get_agent

    agent = get_agent()
    full_answer = ""

    async for chunk in agent.ask_stream(message):
        parsed = json.loads(chunk)
        if parsed["type"] == "token":
            full_answer += parsed["content"]
        yield f"data: {chunk}\n\n"

    assistant_msg = ChatMessage(
        session_id=session_id, role="assistant", content=full_answer
    )
    db.add(assistant_msg)
    await db.commit()


async def get_daily_summary(db: AsyncSession, user_id: uuid.UUID) -> str:
    from datetime import timedelta
    KST = timezone(timedelta(hours=9))
    today_str = datetime.now(KST).strftime("%Y-%m-%d")
    cache_key = f"summary:{user_id}:{today_str}"
    try:
        from core.redis import get_redis_pool

        redis = get_redis_pool()
        cached = await redis.get(cache_key)
        if cached:
            return cached
    except Exception:
        pass

    from services.schedule_service import get_schedules, get_category_count, get_next_exam

    today_ym = today_str[:7]  # YYYY-MM

    # 이번 달 전체 일정 조회 후 오늘 일정만 필터
    all_schedules = await get_schedules(db, user_id, today_ym)
    today_schedules = [s for s in all_schedules if s["date"] == today_str]

    # 남은 과제·시험 개수
    assignment_count = await get_category_count(db, user_id, "과제")
    next_exam = await get_next_exam(db, user_id)

    parts = []

    # 오늘의 일정 목록
    if today_schedules:
        schedule_lines = []
        for s in today_schedules:
            time_label = f" {s['time']}" if s.get("time") else " (종일)"
            schedule_lines.append(f"  - [{s['category']}] {s['title']}{time_label}")
        parts.append("오늘 일정:\n" + "\n".join(schedule_lines))
    else:
        parts.append("오늘 일정: 없음")

    # 남은 과제
    parts.append(f"남은 과제(캘린더): {assignment_count}개")

    # 다음 시험
    if next_exam:
        parts.append(f"다음 시험: {next_exam['title']} (D-{next_exam['dday']})")
    else:
        parts.append("예정된 시험: 없음")

    context = "\n".join(parts)

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY.strip())
        resp = await client.chat.completions.create(
            model=settings.OPENAI_LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "한신대학교 AI 도우미입니다. "
                        "학생의 캘린더 일정과 오늘 현황을 바탕으로 2~3문장으로 친근하게 브리핑해주세요. "
                        "오늘 일정이 있으면 구체적으로 언급해주세요."
                    ),
                },
                {"role": "user", "content": context},
            ],
            temperature=0.7,
            max_tokens=200,
        )
        summary = resp.choices[0].message.content or "오늘의 요약을 생성할 수 없습니다."
    except Exception as e:
        logger.error(f"일일 요약 생성 실패: {e}")
        summary = f"오늘의 현황: {context}"

    try:
        from core.redis import get_redis_pool

        redis = get_redis_pool()
        await redis.set(cache_key, summary, ex=3600)
    except Exception:
        pass

    return summary
