from __future__ import annotations

import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from venuenav.config.settings import get_settings
from venuenav.modules.events import router as events_router
from venuenav.modules.maps import router as maps_router
from venuenav.modules.organizations import router as org_router
from venuenav.modules.public import router as public_router
from venuenav.modules.uploads import service as upload_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("venuenav")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.s3_access_key and s.s3_secret_key:
        try:
            upload_service.ensure_bucket()
        except Exception as e:
            logger.warning("MinIO not ready yet: %s", e)
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title=s.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def valid_err(_: Request, exc: RequestValidationError) -> JSONResponse:  # type: ignore[no-untyped-def]
        return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "message": str(exc)})

    @app.get("/health", tags=["Health"])
    def health() -> dict:
        return {"status": "ok"}

    p = s.api_prefix
    app.include_router(org_router, prefix=p)
    app.include_router(events_router, prefix=p)
    app.include_router(maps_router, prefix=p)
    app.include_router(public_router, prefix=p)
    return app


app = create_app()
