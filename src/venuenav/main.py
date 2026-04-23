from __future__ import annotations

import logging
import traceback
from contextlib import asynccontextmanager

from venuenav.config.settings import get_settings
from venuenav.observability.logging_config import setup_logging

_s = get_settings()
setup_logging(_s)

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from venuenav.common.database import engine
from venuenav.modules.events import router as events_router
from venuenav.modules.maps import router as maps_router
from venuenav.modules.organizations import router as org_router
from venuenav.modules.public import router as public_router
from venuenav.modules.uploads import service as upload_service
from venuenav.observability.health import health_payload
from venuenav.observability.middleware import RequestLogMiddleware
from venuenav.observability.startup import validate_settings

logger = logging.getLogger("venuenav.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    try:
        validate_settings(s)
    except RuntimeError as e:
        logger.error("startup_config_invalid: %s", e)
        raise
    if s.s3_access_key and s.s3_secret_key:
        try:
            upload_service.ensure_bucket()
        except Exception as e:
            logger.warning("minio_not_ready: %s", e)
    yield


def create_app() -> FastAPI:
    s = get_settings()
    if s.sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.logging import LoggingIntegration
            from sentry_sdk.integrations.starlette import StarletteIntegration

            sentry_sdk.init(
                dsn=s.sentry_dsn,
                environment=s.environment,
                release=s.app_version,
                traces_sample_rate=s.sentry_traces_sample_rate,
                integrations=[
                    StarletteIntegration(),
                    FastApiIntegration(),
                    LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
                ],
            )
        except Exception as e:
            logger.warning("sentry_init_failed: %s", e)
    app = FastAPI(
        title=s.app_name,
        version=s.app_version,
        lifespan=lifespan,
    )
    if s.prometheus_enabled:
        try:
            from prometheus_fastapi_instrumentator import Instrumentator

            Instrumentator().instrument(app).expose(
                app, should_gzip=True, endpoint=s.metrics_path, include_in_schema=False
            )
        except Exception as e:
            logger.warning("prometheus_instrumentator_failed: %s", e)

    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail} if not isinstance(exc.detail, dict) else exc.detail,
            )
        if s.sentry_dsn:
            try:
                import sentry_sdk

                sentry_sdk.capture_exception(exc)
            except Exception:
                pass
        tb = traceback.format_exc()
        logger.error(
            "unhandled_error",
            extra={
                "event": "unhandled_error",
                "error": str(exc)[:2000],
                "traceback": tb[:8000] if s.debug else None,
            },
        )
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
        )

    @app.exception_handler(RequestValidationError)
    async def valid_err(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "message": str(exc)})

    @app.get("/healthz", tags=["Health"])
    def liveness() -> dict:
        """Always 200 if the process accepts connections (liveness)."""
        return {"status": "ok", "service": s.service_name}

    @app.get("/ready", tags=["Health"])
    def readiness() -> JSONResponse:
        body = health_payload(s, engine)
        code = 200 if body.get("ready") else 503
        return JSONResponse(status_code=code, content=body)

    @app.get("/health", tags=["Health"])
    def health() -> JSONResponse:
        body = health_payload(s, engine)
        code = 200 if body.get("ready") else 503
        return JSONResponse(status_code=code, content=body)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def root_landing() -> str:
        p = s.api_prefix
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VenueNav API</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #0f172a; }}
    h1 {{ font-size: 1.25rem; }}
    a {{ color: #2563eb; }}
    code {{ background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>VenueNav API is running</h1>
  <p>This host serves the <strong>backend only</strong>. The map UI lives in the <code>public-web</code> app.</p>
  <p>Set <code>VITE_API_BASE</code> in the front-end to this API’s origin.</p>
  <ul>
    <li><a href="/docs">OpenAPI (Swagger)</a> · <a href="/redoc">ReDoc</a></li>
    <li><a href="/healthz">Liveness (always 200 if up)</a></li>
    <li><a href="/ready">Readiness (DB + Redis; 503 if unhealthy)</a></li>
    <li><a href="/metrics">Prometheus metrics</a> (if enabled)</li>
    <li>API base: <code>{p}</code></li>
  </ul>
</body>
</html>"""

    p = s.api_prefix
    app.include_router(org_router, prefix=p)
    app.include_router(events_router, prefix=p)
    app.include_router(maps_router, prefix=p)
    app.include_router(public_router, prefix=p)
    return app


app = create_app()
