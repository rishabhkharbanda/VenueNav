from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "VenueNav API"
    debug: bool = False
    api_prefix: str = "/v1"

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
