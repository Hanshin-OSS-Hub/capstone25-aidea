import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from core.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

from core.db_logger import setup_db_logging
setup_db_logging(engine)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """라우터/서비스에서 Depends(get_db)로 주입"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """헬스체크 및 startup 이벤트에서 사용"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"DB 연결 실패: {e}")
        return False


async def enable_pgvector() -> None:
    """pgvector 확장 활성화 (startup 이벤트에서 호출)"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await session.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
            await session.commit()
        logger.info("pgvector 확장 활성화 완료")
    except Exception as e:
        logger.warning(f"pgvector 확장 활성화 실패 (이미 존재하거나 권한 없음): {e}")
