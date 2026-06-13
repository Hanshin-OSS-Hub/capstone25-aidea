import logging
from typing import AsyncGenerator
import redis.asyncio as aioredis

from core.config import settings

logger = logging.getLogger(__name__)

# 앱 전체에서 재사용하는 커넥션 풀
_redis_pool: aioredis.Redis | None = None


def get_redis_pool() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """라우터/서비스에서 Depends(get_redis)로 주입"""
    redis = get_redis_pool()
    try:
        yield redis
    finally:
        pass  # 커넥션 풀은 앱 생명주기 동안 유지


async def check_redis_connection() -> bool:
    """헬스체크 및 startup 이벤트에서 사용"""
    try:
        redis = get_redis_pool()
        await redis.ping()
        return True
    except Exception as e:
        logger.error(f"Redis 연결 실패: {e}")
        return False


async def close_redis() -> None:
    """shutdown 이벤트에서 호출"""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
