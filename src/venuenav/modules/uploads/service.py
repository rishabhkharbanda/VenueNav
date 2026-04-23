from __future__ import annotations

import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse

import boto3
from botocore.client import Config
from sqlalchemy.orm import Session

from venuenav.config.settings import get_settings
from venuenav.db.models import MapAsset, VenueMap


def _publicize_url(u: str) -> str:
    s = get_settings()
    if not s.s3_public_endpoint:
        return u
    p1 = urlparse(s.s3_endpoint_url)
    p2 = urlparse(s.s3_public_endpoint)
    pu = urlparse(u)
    if p1.netloc and pu.netloc == p1.netloc:
        pu = pu._replace(netloc=p2.netloc, scheme=p2.scheme)
        return urlunparse(pu)
    return u


def _client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        region_name=s.s3_region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket() -> None:
    s = get_settings()
    c = _client()
    try:
        c.head_bucket(Bucket=s.s3_bucket)
    except Exception:
        c.create_bucket(Bucket=s.s3_bucket)


def presign_pdf_upload(db: Session, m: VenueMap, content_type: str, byte_size: int | None) -> dict:
    ensure_bucket()
    s = get_settings()
    asset_id = uuid.uuid4()
    key = f"maps/{m.id}/{asset_id}.pdf"
    c = _client()
    url = c.generate_presigned_url(
        "put_object",
        Params={"Bucket": s.s3_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=s.presign_expires_seconds,
    )
    url = _publicize_url(url)
    public_url = _publicize_url(f"{s.s3_endpoint_url.rstrip('/')}/{s.s3_bucket}/{key}")
    row = MapAsset(
        id=asset_id,
        map_id=m.id,
        kind="pdf",
        storage_url=public_url,
        byte_size=byte_size,
        meta={},
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"upload_url": url, "asset_id": asset_id, "headers": {"Content-Type": content_type}}
