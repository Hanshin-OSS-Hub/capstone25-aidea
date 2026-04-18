import logging
from typing import Optional

from langchain_core.tools import tool
from sqlalchemy import select, or_, desc

logger = logging.getLogger(__name__)


def _format_notice_results(notices, max_results=5) -> str:
    if not notices:
        return "검색된 공지사항이 없습니다."

    lines = [f"총 {len(notices)}개의 공지사항을 찾았습니다.\n"]
    for i, n in enumerate(notices[:max_results], 1):
        lines.append(f"[{i}] {n.title}")
        lines.append(f"   카테고리: {n.category or '일반'}")
        if n.published_at:
            lines.append(f"   게시일: {n.published_at.strftime('%Y-%m-%d')}")
        if n.source_url:
            lines.append(f"   링크: {n.source_url}")
        if n.content:
            summary = n.content[:200].replace("\n", " ")
            lines.append(f"   내용: {summary}...")
        lines.append("")

    if len(notices) > max_results:
        lines.append(f"(외 {len(notices) - max_results}건)")
    return "\n".join(lines)


@tool
async def fetch_notices(query: str, category: Optional[str] = None) -> str:
    """한신대학교 공지사항을 키워드로 검색합니다.
    DB에서 제목과 내용을 ILIKE 키워드로 검색합니다.

    Args:
        query: 검색 키워드 (예: "장학금 신청", "AI 대회")
        category: 카테고리 필터 ("notice", "event", "academic", "scholarship", "employment", "privacy")
    """
    from core.database import AsyncSessionLocal
    from models.notice import Notice

    async with AsyncSessionLocal() as session:
        stmt = select(Notice)

        if category:
            stmt = stmt.where(Notice.category == category)

        keywords = [k.strip() for k in query.split() if len(k.strip()) >= 2]
        if not keywords:
            keywords = [query]

        conditions = []
        for kw in keywords[:5]:
            term = f"%{kw}%"
            conditions.append(Notice.title.ilike(term))
            conditions.append(Notice.content.ilike(term))

        stmt = stmt.where(or_(*conditions))
        stmt = stmt.order_by(desc(Notice.published_at)).limit(10)

        result = await session.execute(stmt)
        notices = result.scalars().all()

    return _format_notice_results(notices)
