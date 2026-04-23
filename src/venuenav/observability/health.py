"""Readiness checks for /ready and enhanced /health."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from venuenav.config.settings import Settings


def check_database(engine: Engine) -> tuple[str, bool]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok", True
    except Exception as e:
        return f"unhealthy: {e!s}", False


def check_redis_client() -> tuple[str, bool]:
    try:
        from venuenav.common.redis_client import get_redis

        r = get_redis()
        r.ping()
        return "ok", True
    except Exception as e:
        return f"unhealthy: {e!s}", False


def health_payload(s: Settings, engine: Engine) -> dict[str, Any]:
    db_msg, db_ok = check_database(engine)
    redis_msg, redis_ok = check_redis_client()
    all_ok = db_ok and redis_ok
    body: dict[str, Any] = {
        "status": "ok" if all_ok else "degraded",
        "service": s.service_name,
        "environment": s.environment,
        "version": s.app_version,
        "components": {
            "database": db_msg,
            "redis": redis_msg,
        },
        "ready": all_ok,
    }
    return body
