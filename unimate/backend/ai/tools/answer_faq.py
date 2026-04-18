import logging

from langchain_core.tools import tool
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _format_search_results(results, max_length=3000) -> str:
    if not results:
        return "관련 정보를 찾을 수 없습니다. 다른 키워드로 검색해보세요."

    lines = []
    for i, r in enumerate(results, 1):
        source_label = "공지" if r["source"] == "notice" else "규정"
        similarity_pct = int(r["similarity"] * 100)
        lines.append(f"\n--- [{source_label} {i}] (유사도: {similarity_pct}%) ---")
        if r.get("title"):
            lines.append(f"제목: {r['title']}")
        content = r.get("content", "")
        if len(content) > 500:
            content = content[:500] + "..."
        lines.append(content)

    output = "\n".join(lines)
    if len(output) > max_length:
        output = output[:max_length] + "\n..."
    return output


@tool
async def answer_faq(query: str) -> str:
    """장학금 규정, 학사 규정 등을 벡터 검색으로 답변합니다.
    notices 테이블(공지, 유사도 >= 0.60)과 qa_documents 테이블(PDF 규정, 유사도 >= 0.40)을
    동시에 검색하여 관련 결과를 반환합니다.

    Args:
        query: 검색할 질문 (예: "장학금 신청 자격이 뭐야?", "휴학 규정 알려줘")
    """
    from openai import AsyncOpenAI
    from core.config import settings
    from core.database import AsyncSessionLocal

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY.strip())
    resp = await client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=query,
    )
    query_embedding = resp.data[0].embedding
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    all_results = []

    async with AsyncSessionLocal() as session:
        notice_rows = await session.execute(
            text("""
                SELECT title, content,
                       1 - (embedding <=> CAST(:emb AS vector)) AS similarity
                FROM notices
                WHERE embedding IS NOT NULL
                  AND 1 - (embedding <=> CAST(:emb AS vector)) >= 0.60
                ORDER BY similarity DESC
                LIMIT 5
            """),
            {"emb": embedding_str},
        )
        for row in notice_rows:
            all_results.append({
                "source": "notice",
                "title": row.title,
                "content": row.content or "",
                "similarity": float(row.similarity),
            })

        # PDF 규정 문서는 공식 문어체라 유사도가 낮게 측정되므로 별도 임계값 적용
        qa_rows = await session.execute(
            text("""
                SELECT title, content,
                       1 - (embedding <=> CAST(:emb AS vector)) AS similarity
                FROM qa_documents
                WHERE embedding IS NOT NULL
                  AND 1 - (embedding <=> CAST(:emb AS vector)) >= 0.40
                ORDER BY similarity DESC
                LIMIT 5
            """),
            {"emb": embedding_str},
        )
        for row in qa_rows:
            all_results.append({
                "source": "qa_doc",
                "title": row.title,
                "content": row.content or "",
                "similarity": float(row.similarity),
            })

    all_results.sort(key=lambda x: x["similarity"], reverse=True)
    return _format_search_results(all_results)
