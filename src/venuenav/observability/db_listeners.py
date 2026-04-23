"""SQLAlchemy slow-query logging."""

from __future__ import annotations

import logging
import time
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine

LOG = logging.getLogger("venuenav.db.slow_sql")


def attach_slow_query_listener(engine: Engine, threshold_ms: float) -> None:
    if threshold_ms <= 0:
        return

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(
        conn: Any, cursor: Any, statement: str, parameters: Any, context: Any, executemany: bool
    ) -> None:
        conn.info["_venuenav_qt0"] = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(
        conn: Any, cursor: Any, statement: str, parameters: Any, context: Any, executemany: bool
    ) -> None:
        t0 = conn.info.pop("_venuenav_qt0", None)
        if t0 is None:
            return
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if elapsed_ms >= threshold_ms:
            from venuenav.observability.metrics import DB_QUERIES_SLOW

            DB_QUERIES_SLOW.inc()
            LOG.warning(
                "slow_query",
                extra={
                    "event": "slow_query",
                    "duration_ms": round(elapsed_ms, 2),
                    "threshold_ms": threshold_ms,
                    "statement_snippet": statement[:500] if statement else "",
                },
            )
