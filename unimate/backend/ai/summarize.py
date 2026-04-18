import logging

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "당신은 대학 공지사항을 요약하는 어시스턴트입니다. "
    "학생이 빠르게 핵심을 파악할 수 있도록 2~3문장으로 요약해주세요. "
    "신청 기간, 대상, 제출 서류, 방법 등 중요한 세부사항을 포함하세요. "
    "불필요한 인사말 없이 바로 내용을 요약하세요."
)


async def summarize_notice(title: str, content: str) -> str:
    """공지 제목과 본문을 받아 AI 요약 반환."""
    from openai import AsyncOpenAI
    from core.config import settings

    text = f"제목: {title}\n\n내용:\n{content[:2000]}"

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY.strip())
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        max_tokens=200,
        temperature=0.3,
    )
    summary = (resp.choices[0].message.content or "").strip()
    logger.info(f"[요약] '{title[:40]}' 완료 ({len(summary)}자)")
    return summary
