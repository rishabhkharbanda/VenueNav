import redis
from redis.backoff import ExponentialBackoff
from redis.exceptions import ConnectionError, TimeoutError
from redis.retry import Retry

from venuenav.config.settings import get_settings


def get_redis() -> redis.Redis:
    s = get_settings()
    retry = ExponentialBackoff()
    r = redis.from_url(
        s.redis_url,
        decode_responses=True,
        socket_connect_timeout=s.redis_connect_timeout_seconds,
        socket_timeout=s.redis_socket_timeout_seconds,
        health_check_interval=30,
        retry=Retry(retry, retries=max(0, s.redis_max_retries)),
        retry_on_error=[ConnectionError, TimeoutError],
    )
    return r
