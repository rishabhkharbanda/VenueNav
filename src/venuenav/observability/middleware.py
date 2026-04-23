"""HTTP request logging: request ID, duration, status; low overhead."""

from __future__ import annotations

import logging
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from venuenav.observability.logging_config import new_request_id

LOG = logging.getLogger("venuenav.http")


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Logs one JSON line per request (see setup_logging)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get("x-request-id") or new_request_id()
        t0 = time.perf_counter()
        path = request.url.path
        method = request.method
        try:
            response = await call_next(request)
        except Exception:
            ms = (time.perf_counter() - t0) * 1000.0
            LOG.exception(
                "request_failed",
                extra={
                    "request_id": rid,
                    "method": method,
                    "path": path,
                    "latency_ms": round(ms, 2),
                    "status_code": 500,
                    "event": "http_request",
                },
            )
            raise
        ms = (time.perf_counter() - t0) * 1000.0
        response.headers["X-Request-ID"] = rid
        # Don't log health/metrics at INFO to cut noise (optional downsample)
        if path in ("/health", "/ready", "/metrics", "/healthz"):
            LOG.debug(
                "request",
                extra={
                    "request_id": rid,
                    "method": method,
                    "path": path,
                    "latency_ms": round(ms, 2),
                    "status_code": response.status_code,
                    "event": "http_request",
                },
            )
        else:
            LOG.info(
                "request",
                extra={
                    "request_id": rid,
                    "method": method,
                    "path": path,
                    "latency_ms": round(ms, 2),
                    "status_code": response.status_code,
                    "event": "http_request",
                },
            )
        return response
