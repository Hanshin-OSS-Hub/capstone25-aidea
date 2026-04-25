"""
Redis 캐시 헬퍼

사용법:
    data = await cache_get("key")
    await cache_set("key", data, ttl=300)
    await cache_delete("key1", "key2")
    await cache_delete_pattern("notices:list:*")
"""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_redis():
    from core.redis import get_redis_pool
    return get_redis_pool()


async def cache_get(key: str) -> Any | None:
    try:
        val = await _get_redis().get(key)
        return json.loads(val) if val else None
    except Exception as e:
        logger.warning(f"[CACHE] get 실패 ({key}): {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    try:
        await _get_redis().setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"[CACHE] set 실패 ({key}): {e}")


async def cache_delete(*keys: str) -> None:
    if not keys:
        return
    try:
        await _get_redis().delete(*keys)
    except Exception as e:
        logger.warning(f"[CACHE] delete 실패 {keys}: {e}")


async def cache_delete_pattern(pattern: str) -> None:
    """패턴 매칭으로 여러 키 한번에 삭제 (ex: 'notices:list:*')"""
    try:
        redis = _get_redis()
        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)
    except Exception as e:
        logger.warning(f"[CACHE] delete_pattern 실패 ({pattern}): {e}")
