import logging
from datetime import datetime, timedelta, timezone

from langchain_core.tools import tool
from sqlalchemy import select, desc

logger = logging.getLogger(__name__)


def _format_deadline_results(notices, days_ahead: int) -> str:
    if not notices:
        return f"최근 {days_ahead}일 이내에 게시된 공지사항이 없습니다."

    lines = [f"최근 {days_ahead}일 이내 공지 {len(notices)}건:\n"]
    for i, n in enumerate(notices, 1):
        lines.append(f"[{i}] {n.title}")
        lines.append(f"   카테고리: {n.category or '일반'}")
        if n.published_at:
            lines.append(f"   게시일: {n.published_at.strftime('%Y-%m-%d')}")
        if n.source_url:
            lines.append(f"   링크: {n.source_url}")
        if n.content:
            summary = n.content[:150].replace("\n", " ")
            lines.append(f"   내용: {summary}...")
        lines.append("")
    return "\n".join(lines)


@tool
async def search_by_deadline(days_ahead: int = 7) -> str:
    """마감 임박 또는 최근 게시된 공지사항을 조회합니다.
    published_at 기준 N일 이내에 게시된 공지를 반환합니다.

    Args:
        days_ahead: 최근 며칠 이내 공지 조회 (기본 7일)
    """
    from core.database import AsyncSessionLocal
    from models.notice import Notice

    async with AsyncSessionLocal() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_ahead)
        stmt = (
            select(Notice)
            .where(Notice.published_at >= cutoff)
            .order_by(desc(Notice.published_at))
            .limit(10)
        )
        result = await session.execute(stmt)
        notices = result.scalars().all()

    return _format_deadline_results(notices, days_ahead)
