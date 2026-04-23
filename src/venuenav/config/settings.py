from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "VenueNav API"
    service_name: str = Field(default="api", description="Name in structured logs and metrics")
    app_version: str = Field(default="0.0.0", description="Build or release (set APP_VERSION in deploy)")
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    api_prefix: str = "/v1"

    # Observability
    log_level: str = Field(default="INFO", description="DEBUG, INFO, WARN, ERROR")
    log_json: bool = Field(default=True, description="JSON log lines to stdout in production")
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = Field(default=0.1, ge=0.0, le=1.0)
    prometheus_enabled: bool = True
    metrics_path: str = "/metrics"
    slow_query_log_ms: float = Field(default=100.0, description="Log SQL queries slower than this (0=disable)")

    # Production safety (optional strict checks on startup)
    require_non_local_services: bool = False
    fail_on_invalid_config: bool = False

    # DB / Redis hardening
    db_connect_timeout_seconds: int = 10
    db_statement_timeout_ms: int = 60_000
    redis_socket_timeout_seconds: float = 5.0
    redis_connect_timeout_seconds: float = 5.0
    redis_max_retries: int = 2

    database_url: str = "postgresql+psycopg://venuenav:venuenav@localhost:5432/venuenav"
    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "venuenav"
    s3_region: str = "us-east-1"
    s3_use_ssl: bool = False
    s3_public_endpoint: str | None = None
    presign_expires_seconds: int = 3600

    auth_disabled: bool = True
    default_dev_user_email: str = "dev@localhost"

    route_cache_ttl_seconds: int = 3600
    payload_cache_ttl_seconds: int = 300

    job_queue_key: str = "venuenav:map_jobs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
