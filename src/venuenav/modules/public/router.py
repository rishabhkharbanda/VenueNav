from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from venuenav.common.dtos import MapPayloadDTO, RouteResponseDTO
from venuenav.common.deps import DbSession
from venuenav.common.errors import not_found
from venuenav.common.redis_client import get_redis
from venuenav.db.models import Event, MapVersion, VenueMap
from venuenav.modules.graph import edge_live as edge_live_service
from venuenav.modules.graph import service as graph_service
from venuenav.modules.routing import service as route_service
from venuenav.modules.search import service as search_service

router = APIRouter()


@router.get(
    "/public/events/{event_slug}/maps/{map_slug}",
    response_model=dict,
    tags=["Maps"],
)
def public_map_meta(event_slug: str, map_slug: str, db: DbSession) -> dict:
    m = (
        db.execute(
            select(VenueMap)
            .join(Event, Event.id == VenueMap.event_id)
            .where(Event.slug == event_slug, VenueMap.slug == map_slug)
        )
        .scalar_one_or_none()
    )
    if m is None or m.published_map_version_id is None:
        raise not_found("Map")
    mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise not_found("Version")
    rurl = graph_service._raster_url(db, m.id)
    return {
        "map_id": str(m.id),
        "map_version_id": str(mv.id),
        "raster_url": rurl,
        "name": m.name,
    }


@router.get(
    "/public/maps/{map_id}/route",
    response_model=RouteResponseDTO,
    tags=["Routing"],
)
def public_route(
    map_id: uuid.UUID,
    db: DbSession,
    from_node: str,
    to_node: str,
    version: int | None = None,
) -> RouteResponseDTO:
    m = db.get(VenueMap, map_id)
    if m is None:
        raise not_found("Map")
    mv = route_service.resolve_published_version(db, m, version)
    return route_service.route_between(db, m, mv, get_redis(), from_node, to_node)


class MultiBody(BaseModel):
    stop_node_ids: list[str] = Field(..., min_length=2)
    optimize: bool = False


@router.post(
    "/public/maps/{map_id}/route/multi",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    tags=["Routing"],
)
def public_route_multi(
    map_id: uuid.UUID,
    db: DbSession,
    body: MultiBody = Body(...),
) -> dict:
    m = db.get(VenueMap, map_id)
    if m is None:
        raise not_found("Map")
    mv = route_service.resolve_published_version(db, m, None)
    return route_service.route_multi(
        db, m, mv, get_redis(), body.stop_node_ids, body.optimize
    )


@router.get(
    "/public/maps/{map_id}/live-edges",
    response_model=dict,
    tags=["Routing"],
)
def public_live_edges(map_id: uuid.UUID, db: DbSession) -> dict:
    m = db.get(VenueMap, map_id)
    if m is None or m.published_map_version_id is None:
        raise not_found("Map")
    mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise not_found("Version")
    r = get_redis()
    epoch = edge_live_service.get_live_epoch(r, m.id) if r else 0
    rows = edge_live_service.list_live_for_version(db, mv.id)
    return {
        "map_id": str(m.id),
        "map_version_id": str(mv.id),
        "live_epoch": epoch,
        "edges": [edge_live_service.live_row_to_dict(x) for x in rows],
    }


@router.get(
    "/public/maps/{map_id}/search",
    response_model=dict,
    tags=["Search"],
)
def public_search(
    map_id: uuid.UUID,
    q: str,
    db: DbSession,
    version: int | None = None,
) -> dict:
    m = db.get(VenueMap, map_id)
    if m is None:
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
        if m.published_map_version_id is None:
            raise not_found("Map")
        mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise not_found("Version")
    items = search_service.search_shops(db, mv.id, q)
    return {"items": [i.model_dump() for i in items]}
