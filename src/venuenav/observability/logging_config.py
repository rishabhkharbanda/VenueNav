"""Structured JSON logging to stdout (Railway/12-factor)."""

from __future__ import annotations

import logging
import sys
import uuid
from typing import Any

from venuenav.config.settings import Settings

_configured = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def setup_logging(s: Settings) -> None:
    global _configured
    if _configured:
        return

    lvl = s.log_level.upper()
    if lvl == "WARN":
        lvl = "WARNING"
    level = getattr(logging, lvl, logging.INFO)
    if s.debug and s.log_level.upper() == "INFO":
        level = logging.DEBUG

    root_venu = logging.getLogger("venuenav")
    root_venu.setLevel(level)
    root_venu.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    if s.log_json:
        from pythonjsonlogger import jsonlogger

        fmt = jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
            json_ensure_ascii=False,
        )
        handler.setFormatter(fmt)
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(name)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
        )

    root_venu.addHandler(handler)
    # Reduce noise
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    _configured = True


def new_request_id() -> str:
    return str(uuid.uuid4())
