"""Map processing worker: poll Redis job queue, stub image/PDF steps, update job rows."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

import redis
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from venuenav.config.settings import get_settings
from venuenav.db.models import MapAsset, MapProcessingJob, VenueMap

logger = logging.getLogger("venuenav.worker")
logging.basicConfig(level=logging.INFO)

_settings = get_settings()
_engine = create_engine(_settings.database_url, pool_pre_ping=True)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine, expire_on_commit=False)


def _process_stub(db: Session, job: MapProcessingJob) -> None:
    """Simulate pipeline: queued → rasterizing → detecting → ocr → awaiting_review."""
    stages = [("rasterizing", 0.2), ("detecting", 0.5), ("ocr", 0.8), ("awaiting_review", 1.0)]
    m = db.get(VenueMap, job.map_id)
    for status, pr in stages:
        job.status = status
        job.progress = pr
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        time.sleep(0.3)
    if m and m.draft_map_version_id:
        has_r = (
            db.execute(
                select(MapAsset).where(MapAsset.map_id == m.id, MapAsset.kind == "raster")
            )
            .scalars()
            .first()
        )
        if not has_r:
            a = MapAsset(
                id=uuid.uuid4(),
                map_id=m.id,
                kind="raster",
                storage_url="stub://raster/placeholder.png",
                byte_size=0,
                meta={"note": "stub from worker", "job_id": str(job.id)},
                created_at=datetime.now(timezone.utc),
            )
            db.add(a)
    job.status = "awaiting_review"
    job.progress = 1.0
    job.updated_at = datetime.now(timezone.utc)
    db.commit()


def run() -> None:
    r = redis.from_url(_settings.redis_url, decode_responses=True)
    key = _settings.job_queue_key
    logger.info("Worker listening on %s", key)
    while True:
        try:
            out = r.brpop(key, timeout=5)
            if not out:
                continue
            _, job_id = out
            with _Session() as db:
                job = db.get(MapProcessingJob, uuid.UUID(job_id))
                if not job or job.map_id is None:
                    continue
                try:
                    _process_stub(db, job)
                except Exception as e:
                    logger.exception("Job failed: %s", e)
                    job = db.get(MapProcessingJob, uuid.UUID(job_id))
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)[:2000]
                        job.updated_at = datetime.now(timezone.utc)
                        db.commit()
        except Exception as e:
            logger.error("Loop error: %s", e)
            time.sleep(2)


if __name__ == "__main__":
    run()
