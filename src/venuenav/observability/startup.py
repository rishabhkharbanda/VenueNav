"""Validate required configuration in production."""

from __future__ import annotations

import logging

from venuenav.config.settings import Settings

LOG = logging.getLogger("venuenav.startup")


def validate_settings(s: Settings) -> None:
    """Fail fast when critical settings are missing in production-like envs."""
    if s.environment not in ("staging", "production"):
        return
    errors: list[str] = []
    if s.require_non_local_services and (not s.database_url or "localhost" in s.database_url):
        errors.append("DATABASE_URL must point to a non-local database in this environment")
    if s.require_non_local_services and (not s.redis_url or "localhost" in s.redis_url):
        errors.append("REDIS_URL must point to a non-local Redis in this environment")
    if errors:
        msg = "; ".join(errors)
        if s.fail_on_invalid_config:
            raise RuntimeError(f"Invalid configuration: {msg}")
        LOG.warning("configuration_warning: %s", msg)
