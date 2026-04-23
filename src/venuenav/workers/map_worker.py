"""Map processing worker: poll Redis, run PDF→raster+import pipeline, update DB."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from venuenav.config.settings import get_settings
from venuenav.common.database import SessionLocal
from venuenav.db.models import MapAsset, MapProcessingJob, MapVersion, VenueMap
from venuenav.modules.routing.cache import graph_cache
from venuenav.modules.uploads import service as upload_service
from venuenav.observability.logging_config import get_logger, setup_logging
from venuenav.pipeline.run import run_pdf_import
from venuenav.workers.pipeline_io import fetch_pdf_bytes

# Logging before other imports that use loggers
setup_logging(get_settings())
logger = get_logger("venuenav.worker")


def _pdf_asset_for_job(db: Session, m: VenueMap, job: MapProcessingJob) -> MapAsset | None:
    if job.asset_id:
        a = db.get(MapAsset, job.asset_id)
        if a and a.kind == "pdf" and a.map_id == m.id:
            return a
    row = (
        db.execute(
            select(MapAsset)
            .where(MapAsset.map_id == m.id, MapAsset.kind == "pdf")
            .order_by(MapAsset.created_at.desc())
        )
        .scalars()
        .first()
    )
    return row


def _process_map_import(db: Session, job: MapProcessingJob) -> None:
    m = db.get(VenueMap, job.map_id)
    if not m or not m.draft_map_version_id:
        raise ValueError("Map or draft version missing")
    d = db.get(MapVersion, m.draft_map_version_id)
    if not d:
        raise ValueError("Draft version row missing")
    a = _pdf_asset_for_job(db, m, job)
    if not a:
        raise ValueError("No PDF asset found — upload a PDF and pass asset_id or store one on the map")

    job.status = "rasterizing"
    job.progress = 0.1
    job.updated_at = datetime.now(timezone.utc)
    db.commit()

    pdf_bytes = fetch_pdf_bytes(a.storage_url)

    job.status = "detecting"
    job.progress = 0.35
    job.updated_at = datetime.now(timezone.utc)
    db.commit()

    out = run_pdf_import(
        pdf_bytes, str(m.id), str(d.id), dpi=150
    )
    import_artifact = out["import_artifact"]
    out["import_artifact"]["raster"] = {
        "width_px": out["width"],
        "height_px": out["height"],
    }

    job.status = "ocr"
    job.progress = 0.6
    job.updated_at = datetime.now(timezone.utc)
    db.commit()

    wpx = int(out["width"])
    hpx = int(out["height"])
    d.width = float(wpx)
    d.height = float(hpx)
    d.unit = "pixel"
    m.updated_at = datetime.now(timezone.utc)

    meta = {
        "import_artifact": out["import_artifact"],
    }
    upload_service.put_raster_png(db, m, out["png_bytes"], meta=meta)
    graph_cache.invalidate_map(m.id) if m else None

    job2 = db.get(MapProcessingJob, job.id)
    if not job2:
        raise RuntimeError("Job row lost after raster upload")
    job2.status = "awaiting_review"
    job2.progress = 1.0
    job2.error_message = None
    job2.updated_at = datetime.now(timezone.utc)
    db.commit()


def run() -> None:
    s = get_settings()
    r = redis.from_url(
        s.redis_url,
        decode_responses=True,
        socket_connect_timeout=s.redis_connect_timeout_seconds,
        socket_timeout=s.redis_socket_timeout_seconds,
        health_check_interval=30,
    )
    key = s.job_queue_key
    logger.info(
        "worker_start",
        extra={"event": "worker_start", "queue_key": key, "service": s.service_name},
    )
    while True:
        try:
            out = r.brpop(key, timeout=5)
            if not out:
                continue
            _, job_id = out
            t0 = time.perf_counter()
            try:
                qafter = r.llen(key)
            except Exception:
                qafter = -1
            logger.info(
                "job_dequeued",
                extra={
                    "event": "map_job_dequeued",
                    "job_id": job_id,
                    "queue_depth_after": qafter,
                    "queue_key": key,
                },
            )
            with SessionLocal() as db:
                job = db.get(MapProcessingJob, uuid.UUID(job_id))
                if not job or job.map_id is None:
                    continue
                logger.info(
                    "job_resolved",
                    extra={"event": "map_job_resolved", "job_id": job_id, "map_id": str(job.map_id)},
                )
                try:
                    _process_map_import(db, job)
                    ms = (time.perf_counter() - t0) * 1000.0
                    logger.info(
                        "job_success",
                        extra={
                            "event": "map_job_success",
                            "job_id": job_id,
                            "map_id": str(job.map_id),
                            "duration_ms": round(ms, 2),
                        },
                    )
                except Exception as e:
                    logger.exception("job_failed")
                    job = db.get(MapProcessingJob, uuid.UUID(job_id))
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)[:2000]
                        job.updated_at = datetime.now(timezone.utc)
                        db.commit()
        except Exception as e:
            logger.error(
                "worker_loop_error",
                extra={"event": "worker_loop_error", "error": str(e)[:2000]},
            )
            time.sleep(2)


if __name__ == "__main__":
    run()
