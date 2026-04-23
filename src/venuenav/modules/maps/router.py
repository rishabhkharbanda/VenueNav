from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, status
from pydantic import BaseModel
from redis import Redis
from slugify import slugify
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session
from venuenav.common.dtos import MapPayloadDTO, MapVersionDTO, ShopDTO, RouteResponseDTO
from venuenav.common.deps import DbSession, UserId, get_org_if_member, require_org_editor, require_org_member
from venuenav.common.errors import http_error, not_found
from venuenav.config.settings import get_settings
from venuenav.db.models import (
    Event,
    GraphEdge,
    GraphNode,
    GraphEdgeLive,
    MapAsset,
    MapProcessingJob,
    MapVersion,
    Shop,
    ShopTag,
    Venue,
    VenueMap,
)
from venuenav.modules.graph import edge_live as edge_live_service
from venuenav.modules.graph import service as graph_service
from venuenav.modules.routing import service as route_service
from venuenav.modules.routing.cache import graph_cache, payload_cache_get, payload_cache_set, payload_key
from venuenav.modules.search import service as search_service
from venuenav.modules.uploads import service as upload_service
from venuenav.common.redis_client import get_redis

router = APIRouter()


def _event_in_org(db: Session, org_id: uuid.UUID, event_id: uuid.UUID) -> Event:
    e = db.get(Event, event_id)
    if e is None or e.organization_id != org_id:
        raise not_found("Event")
    return e


def _venue_in_event(db: Session, event_id: uuid.UUID, venue_id: uuid.UUID) -> Venue:
    v = db.get(Venue, venue_id)
    if v is None or v.event_id != event_id:
        raise not_found("Venue")
    return v


def _map_in_org(db: Session, org_id: uuid.UUID, map_id: uuid.UUID) -> VenueMap:
    m = db.get(VenueMap, map_id)
    if m is None:
        raise not_found("Map")
    e = db.get(Event, m.event_id)
    if e is None or e.organization_id != org_id:
        raise not_found("Map")
    return m


def _rconn() -> Redis:
    return get_redis()  # single client per process


class MapCreate(BaseModel):
    name: str
    venue_id: uuid.UUID


class MapSummaryOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    published_version: int | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get(
    "/organizations/{org_id}/events/{event_id}/maps",
    response_model=dict,
    tags=["Maps"],
)
def list_maps(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    get_org_if_member(db, org_id, user_id)
    _ = _event_in_org(db, org_id, event_id)
    from sqlalchemy import func

    total = (
        db.execute(
            select(func.count(VenueMap.id))
            .where(VenueMap.event_id == event_id)
        ).scalar()
        or 0
    )
    off = (page - 1) * page_size
    rows = (
        db.execute(
            select(VenueMap)
            .where(VenueMap.event_id == event_id)
            .order_by(VenueMap.updated_at.desc())
            .offset(off)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    out = []
    for m in rows:
        pv: int | None = None
        if m.published_map_version_id:
            mv = db.get(MapVersion, m.published_map_version_id)
            if mv:
                pv = mv.version
        out.append(
            {
                "id": str(m.id),
                "name": m.name,
                "status": m.status,
                "published_version": pv,
                "updated_at": m.updated_at,
            }
        )
    return {"items": out, "page": page, "page_size": page_size, "total": int(total)}


@router.post(
    "/organizations/{org_id}/events/{event_id}/maps",
    response_model=MapSummaryOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Maps"],
)
def create_map(
    org_id: uuid.UUID,
    event_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: MapCreate,
) -> MapSummaryOut:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    _ = _event_in_org(db, org_id, event_id)
    _ = _venue_in_event(db, event_id, body.venue_id)
    base = slugify(body.name) or "map"
    m = VenueMap(
        id=uuid.uuid4(),
        event_id=event_id,
        venue_id=body.venue_id,
        name=body.name,
        slug=f"{base}-{str(uuid.uuid4())[:6]}",
        status="draft",
        draft_map_version_id=None,
        published_map_version_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(m)
    db.flush()
    mv = MapVersion(
        id=uuid.uuid4(),
        map_id=m.id,
        version=1,
        width=1.0,
        height=1.0,
        unit="pixel",
        srid=0,
        is_published=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(mv)
    db.commit()
    db.refresh(m)
    db.refresh(mv)
    m.draft_map_version_id = mv.id
    m.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return MapSummaryOut(
        id=m.id,
        name=m.name,
        status=m.status,
        published_version=None,
        updated_at=m.updated_at,
    )


@router.get(
    "/organizations/{org_id}/maps/{map_id}",
    response_model=MapSummaryOut,
    tags=["Maps"],
)
def get_map(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> MapSummaryOut:
    get_org_if_member(db, org_id, user_id)
    m = _map_in_org(db, org_id, map_id)
    pv: int | None = None
    if m.published_map_version_id:
        mv = db.get(MapVersion, m.published_map_version_id)
        if mv:
            pv = mv.version
    return MapSummaryOut(
        id=m.id, name=m.name, status=m.status, published_version=pv, updated_at=m.updated_at
    )


class UploadBody(BaseModel):
    content_type: str = "application/pdf"
    byte_size: int | None = None


@router.post(
    "/organizations/{org_id}/maps/{map_id}/upload",
    response_model=dict,
    tags=["Maps"],
)
def post_upload(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: UploadBody,
) -> dict:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    upload_service.ensure_bucket()
    return upload_service.presign_pdf_upload(db, m, body.content_type, body.byte_size)


class ProcessBody(BaseModel):
    asset_id: uuid.UUID | None = None
    options: dict | None = None


@router.post(
    "/organizations/{org_id}/maps/{map_id}/process",
    response_model=dict,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Processing"],
)
def post_process(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: ProcessBody,
) -> dict:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    job = MapProcessingJob(
        id=uuid.uuid4(),
        map_id=m.id,
        asset_id=body.asset_id,
        status="queued",
        progress=0.0,
        error_message=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    r = _rconn()
    s = get_settings()
    r.lpush(s.job_queue_key, str(job.id))
    return {
        "id": job.id,
        "map_id": m.id,
        "status": job.status,
        "progress": 0.0,
        "error_message": None,
        "created_at": job.created_at,
    }


@router.get(
    "/organizations/{org_id}/maps/{map_id}/jobs/{job_id}",
    response_model=dict,
    tags=["Processing"],
)
def get_job(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    job_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> dict:
    get_org_if_member(db, org_id, user_id)
    _ = _map_in_org(db, org_id, map_id)
    j = db.get(MapProcessingJob, job_id)
    if not j or j.map_id != map_id:
        raise not_found("Job")
    return {
        "id": j.id,
        "map_id": j.map_id,
        "status": j.status,
        "progress": j.progress,
        "error_message": j.error_message,
        "created_at": j.created_at,
    }


@router.get(
    "/organizations/{org_id}/maps/{map_id}/import-artifact",
    response_model=dict,
    tags=["Processing"],
)
def get_import_artifact(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> dict:
    """
    Returns the last PDF-import pipeline output (OCR, suggested graph, zones) stored
    on the most recent raster asset. Null if not processed yet.
    """
    get_org_if_member(db, org_id, user_id)
    m = _map_in_org(db, org_id, map_id)
    row = (
        db.execute(
            select(MapAsset)
            .where(MapAsset.map_id == m.id, MapAsset.kind == "raster")
            .order_by(MapAsset.created_at.desc())
        )
        .scalars()
        .first()
    )
    if not row or not row.meta or "import_artifact" not in row.meta:
        return {
            "artifact": None,
            "raster_url": row.storage_url if row else None,
        }
    return {"artifact": row.meta.get("import_artifact"), "raster_url": row.storage_url}


@router.get(
    "/organizations/{org_id}/maps/{map_id}/graph",
    response_model=MapPayloadDTO,
    tags=["Graph"],
)
def get_graph(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    state: str = "draft",
) -> MapPayloadDTO:
    get_org_if_member(db, org_id, user_id)
    m = _map_in_org(db, org_id, map_id)
    if state == "draft":
        if m.draft_map_version_id is None:
            raise not_found("Draft version")
        mv = db.get(MapVersion, m.draft_map_version_id)
    else:
        if m.published_map_version_id is None:
            raise not_found("Published version")
        mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise not_found("Version")
    rurl = graph_service._raster_url(db, m.id)
    return graph_service.load_map_payload(db, m, mv, rurl)


@router.put(
    "/organizations/{org_id}/maps/{map_id}/graph",
    status_code=status.HTTP_200_OK,
    tags=["Graph"],
)
def put_graph(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    payload: MapPayloadDTO = Body(...),
) -> dict:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    if m.draft_map_version_id is None:
        raise not_found("Draft")
    d = db.get(MapVersion, m.draft_map_version_id)
    if d is None:
        raise not_found("Draft")
    graph_service.replace_draft_graph(db, m, d, payload)
    db.commit()
    return {"ok": True}


class EdgeLivePatchBody(BaseModel):
    crowd_factor: float | None = None
    is_closed: bool | None = None
    priority: float | None = None


@router.patch(
    "/organizations/{org_id}/maps/{map_id}/edges/{edge_id}/live",
    response_model=dict,
    tags=["Graph"],
)
def patch_edge_live(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    edge_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
    body: EdgeLivePatchBody = Body(...),
) -> dict:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    if m.published_map_version_id is None:
        raise not_found("Published map")
    e = db.get(GraphEdge, edge_id)
    if e is None or e.map_version_id != m.published_map_version_id:
        raise not_found("Edge")
    if body.crowd_factor is None and body.is_closed is None and body.priority is None:
        raise http_error("No live fields to update", "BAD_REQUEST", 400)
    if body.crowd_factor is not None and body.crowd_factor <= 0:
        raise http_error("crowd_factor must be > 0", "BAD_REQUEST", 400)
    now = datetime.now(timezone.utc)
    row = db.get(GraphEdgeLive, edge_id)
    if row is None:
        row = GraphEdgeLive(
            graph_edge_id=edge_id,
            crowd_factor=1.0,
            is_closed=False,
            priority=0.0,
            updated_at=now,
        )
        db.add(row)
    if body.crowd_factor is not None:
        row.crowd_factor = float(body.crowd_factor)
    if body.is_closed is not None:
        row.is_closed = bool(body.is_closed)
    if body.priority is not None:
        row.priority = float(body.priority)
    row.updated_at = now
    m.updated_at = now
    r = _rconn()
    if r:
        edge_live_service.bump_live_epoch(r, m.id)
    graph_cache.invalidate_map(m.id)
    db.commit()
    return edge_live_service.live_row_to_dict(row)


@router.post(
    "/organizations/{org_id}/maps/{map_id}/publish",
    response_model=MapVersionDTO,
    tags=["Graph"],
)
def post_publish(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    db: DbSession,
    user_id: UserId,
) -> MapVersionDTO:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    if m.draft_map_version_id is None:
        raise not_found("Draft")
    d = db.get(MapVersion, m.draft_map_version_id)
    if d is None:
        raise not_found("Draft")
    new_mv = graph_service.publish_draft(db, m, d)
    r = _rconn()
    s = get_settings()
    if r:
        edge_live_service.bump_live_epoch(r, m.id)
    pld = graph_service.public_payload_dict(db, m, new_mv)
    if r:
        payload_cache_set(r, payload_key(m.id, new_mv.version), pld, s.payload_cache_ttl_seconds)
    db.commit()
    return MapVersionDTO(
        id=str(new_mv.id),
        version=new_mv.version,
        width=new_mv.width,
        height=new_mv.height,
        unit=new_mv.unit,
        srid=new_mv.srid,
        created_at=new_mv.created_at,
    )


@router.patch(
    "/organizations/{org_id}/maps/{map_id}/shops/{shop_id}",
    response_model=ShopDTO,
    tags=["Shops"],
)
def patch_shop(
    org_id: uuid.UUID,
    map_id: uuid.UUID,
    shop_id: str,
    db: DbSession,
    user_id: UserId,
    body: ShopDTO = Body(...),
) -> ShopDTO:
    m_ = require_org_member(db, org_id, user_id)
    require_org_editor(m_)
    m = _map_in_org(db, org_id, map_id)
    if m.draft_map_version_id is None:
        raise not_found("Draft")
    shop = _resolve_shop(db, m.draft_map_version_id, shop_id)
    if body.name is not None:
        shop.name = body.name
    if body.category is not None:
        shop.category = body.category
    if body.metadata is not None:
        shop.extra = body.metadata
    if body.tags is not None:
        db.execute(delete(ShopTag).where(ShopTag.shop_id == shop.id))
        for t in body.tags:
            db.add(ShopTag(shop_id=shop.id, tag=t))
    shop.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(shop)
    loc = body.location_node
    n = db.get(GraphNode, shop.location_node_id)
    if n:
        loc = n.external_id
    if body.tags is not None:
        tag_list = list(body.tags)
    else:
        tag_list = [
            r[0]
            for r in db.execute(
                text("SELECT tag FROM shop_tag WHERE shop_id = :sid"), {"sid": str(shop.id)}
            ).all()
        ]
    return ShopDTO(
        id=shop.external_id or str(shop.id),
        name=shop.name,
        location_node=loc,
        category=shop.category,
        tags=tag_list,
        metadata=dict(shop.extra or {}),
    )


def _resolve_shop(db: Session, version_id: uuid.UUID, shop_id: str) -> Shop:
    try:
        su = uuid.UUID(shop_id)
        s = (
            db.execute(
                select(Shop).where(Shop.map_version_id == version_id, Shop.id == su)
            )
            .scalars()
            .first()
        )
    except Exception:
        s = None
    if s is None:
        s = (
            db.execute(
                select(Shop).where(Shop.map_version_id == version_id, Shop.external_id == shop_id)
            )
            .scalars()
            .first()
        )
    if s is None:
        raise not_found("Shop")
    return s


@router.get(
    "/public/maps/{map_id}/payload",
    response_model=MapPayloadDTO,
    tags=["Maps"],
)
def public_payload(
    map_id: uuid.UUID,
    db: DbSession,
    version: int | None = None,
) -> MapPayloadDTO:
    m = db.get(VenueMap, map_id)
    if m is None or m.published_map_version_id is None:
        raise not_found("Map")
    if version is not None:
        mv = (
            db.execute(
                select(MapVersion).where(
                    MapVersion.map_id == m.id, MapVersion.version == version, MapVersion.is_published.is_(True)
                )
            )
            .scalar_one_or_none()
        )
    else:
        mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise not_found("Version")
    s = get_settings()
    r = _rconn()
    pkey = payload_key(m.id, mv.version)
    c = payload_cache_get(r, pkey) if r else None
    if c is None:
        c = graph_service.public_payload_dict(db, m, mv)
        if r:
            payload_cache_set(r, pkey, c, s.payload_cache_ttl_seconds)
    return MapPayloadDTO.model_validate(c)