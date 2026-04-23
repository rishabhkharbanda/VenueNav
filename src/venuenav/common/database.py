from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from venuenav.config.settings import get_settings
from venuenav.observability.db_listeners import attach_slow_query_listener

s = get_settings()
_connect: dict = {"connect_timeout": s.db_connect_timeout_seconds}
if s.db_statement_timeout_ms > 0:
    _connect["options"] = f"-c statement_timeout={s.db_statement_timeout_ms}"

engine = create_engine(
    s.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=_connect,
)

attach_slow_query_listener(engine, s.slow_query_log_ms)
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
