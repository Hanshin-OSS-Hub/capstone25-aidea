import logging
import uuid

from openai import AsyncOpenAI
from sqlalchemy import update

from core.config import settings
from core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY.strip())
    return _client


async def _get_embedding(text: str) -> list[float]:
    client = _get_client()
    text = text.replace("\n", " ").strip()
    if not text:
        text = "empty"
    response = await client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=text[:8000],
    )
    return response.data[0].embedding


async def embed_notice(notice_id: uuid.UUID, text: str) -> None:
    from models.notice import Notice

    embedding = await _get_embedding(text)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(Notice)
            .where(Notice.id == notice_id)
            .values(embedding=embedding)
        )
        await session.commit()
    logger.info(f"[Embedding] notice {notice_id} 완료")


async def embed_pdf_chunk(
    title: str, content: str, category: str, source_url: str
) -> None:
    from models.qa_document import QaDocument

    embedding = await _get_embedding(content)

    async with AsyncSessionLocal() as session:
        doc = QaDocument(
            title=title,
            content=content,
            category=category,
            source_url=source_url,
            embedding=embedding,
        )
        session.add(doc)
        await session.commit()
    logger.info(f"[Embedding] PDF chunk '{title[:50]}' 저장 완료")
