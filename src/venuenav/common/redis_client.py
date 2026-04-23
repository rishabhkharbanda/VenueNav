import redis

from venuenav.config.settings import get_settings


def get_redis() -> redis.Redis:
    s = get_settings()
    return redis.from_url(s.redis_url, decode_responses=True)
