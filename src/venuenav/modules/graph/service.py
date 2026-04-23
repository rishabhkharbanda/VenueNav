from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from shapely.geometry import Point
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from venuenav.common.dtos import GraphEdgeDTO, GraphNodeDTO, MapPayloadDTO, ShopDTO
from venuenav.db.models import GraphEdge, GraphEdgeLive, GraphNode, MapAsset, MapVersion, Shop, ShopTag, VenueMap
from venuenav.modules.graph import edge_live as edge_live_service
from venuenav.modules.routing.cache import graph_cache


def _point_wkt(x: float, y: float) -> WKTElement:
    return WKTElement(f"POINT({x} {y})", srid=0)


def _to_xy(geom) -> tuple[float, float]:
    s = to_shape(geom)
    if isinstance(s, Point):
        return float(s.x), float(s.y)
    return float(s.x), float(s.y)  # type: ignore[union-attr]


def _raster_url(db: Session, map_id: UUID) -> str | None:
    row = (
        db.execute(
            select(MapAsset)
            .where(MapAsset.map_id == map_id, MapAsset.kind == "raster")
            .order_by(MapAsset.created_at.desc())
        )
        .scalars()
        .first()
    )
    if row is None:
        return None
    return row.storage_url


def public_payload_dict(db: Session, m: VenueMap, mv: MapVersion) -> dict:
    rurl = _raster_url(db, m.id)
    dto = load_map_payload(db, m, mv, rurl)
    return dto.model_dump(by_alias=True, mode="json")


def load_map_payload(db: Session, m: VenueMap, map_version: MapVersion, raster_url: str | None) -> MapPayloadDTO:
    nodes = (
        db.execute(
            select(GraphNode).where(GraphNode.map_version_id == map_version.id).order_by(GraphNode.external_id)
        )
        .scalars()
        .all()
    )
    ext_by_id: dict[UUID, str] = {n.id: n.external_id for n in nodes}
    node_dtos: list[GraphNodeDTO] = []
    for n in nodes:
        x, y = _to_xy(n.geom)
        node_dtos.append(
            GraphNodeDTO(id=n.external_id, x=x, y=y, type=n.node_type, label=n.label)
        )

    edges = (
        db.execute(select(GraphEdge).where(GraphEdge.map_version_id == map_version.id))
        .scalars()
        .all()
    )
    edge_dtos: list[GraphEdgeDTO] = []
    for e in edges:
        fe = ext_by_id.get(e.from_node_id)
        te = ext_by_id.get(e.to_node_id)
        if not fe or not te:
            continue
        edge_dtos.append(
            GraphEdgeDTO.model_validate(
                {"from": fe, "to": te, "weight": e.weight, "edge_id": str(e.id)}
            )
        )

    shop_rows = list(db.execute(select(Shop).where(Shop.map_version_id == map_version.id)).scalars().all())
    tag_map: dict[UUID, list[str]] = {s.id: [] for s in shop_rows}
    if shop_rows:
        ids_ = [s.id for s in shop_rows]
        trows = db.execute(select(ShopTag).where(ShopTag.shop_id.in_(ids_))).scalars().all()
        for tr in trows:
            tag_map[tr.shop_id].append(tr.tag)

    shop_dtos: list[ShopDTO] = []
    for s in shop_rows:
        loc = ext_by_id.get(s.location_node_id) or str(s.location_node_id)
        eid = s.external_id or str(s.id)
        shop_dtos.append(
            ShopDTO(
                id=eid,
                name=s.name,
                location_node=loc,
                category=s.category,
                tags=tag_map.get(s.id, []),
                metadata=dict(s.extra or {}),
            )
        )

    return MapPayloadDTO(
        map_id=str(m.id),
        map_version_id=str(map_version.id),
        width=map_version.width,
        height=map_version.height,
        unit=map_version.unit,
        raster_url=raster_url,
        nodes=node_dtos,
        edges=edge_dtos,
        shops=shop_dtos,
    )


def replace_draft_graph(db: Session, m: VenueMap, draft: MapVersion, payload: MapPayloadDTO) -> None:
    if payload.width is not None and payload.height is not None:
        draft.width = float(payload.width)
        draft.height = float(payload.height)
    if payload.unit in ("pixel", "meter"):
        draft.unit = payload.unit

    db.execute(
        text("DELETE FROM shop_tag WHERE shop_id IN (SELECT id FROM shop WHERE map_version_id = :vid)"),
        {"vid": str(draft.id)},
    )
    db.execute(delete(Shop).where(Shop.map_version_id == draft.id))
    db.execute(delete(GraphEdge).where(GraphEdge.map_version_id == draft.id))
    db.execute(delete(GraphNode).where(GraphNode.map_version_id == draft.id))
    db.flush()

    ext_to_uuid: dict[str, UUID] = {}
    for n in payload.nodes:
        nid = uuid.uuid4()
        ext_to_uuid[n.id] = nid
        db.add(
            GraphNode(
                id=nid,
                map_version_id=draft.id,
                external_id=n.id,
                node_type=n.type,
                label=n.label,
                geom=_point_wkt(n.x, n.y),
            )
        )
    db.flush()

    for e in payload.edges:
        ed = e.model_dump(by_alias=True)
        a, b = ed["from"], ed["to"]
        u, v = ext_to_uuid.get(a), ext_to_uuid.get(b)
        if u is None or v is None:
            continue
        db.add(
            GraphEdge(
                id=uuid.uuid4(),
                map_version_id=draft.id,
                from_node_id=u,
                to_node_id=v,
                weight=float(e.weight),
                path=None,
            )
        )

    for s in payload.shops:
        loc = ext_to_uuid.get(s.location_node)
        if loc is None:
            continue
        shop_id = uuid.uuid4()
        db.add(
            Shop(
                id=shop_id,
                map_version_id=draft.id,
                external_id=s.id,
                name=s.name,
                category=s.category,
                location_node_id=loc,
                footprint=None,
                extra=dict(s.metadata or {}),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )
        for t in s.tags:
            db.add(ShopTag(shop_id=shop_id, tag=t))

    m.status = "draft"
    m.updated_at = datetime.now(timezone.utc)
    graph_cache.invalidate_map(m.id)


def publish_draft(db: Session, m: VenueMap, draft: MapVersion) -> MapVersion:
    max_v = db.execute(select(func.max(MapVersion.version)).where(MapVersion.map_id == m.id)).scalar() or 0
    new_ver = int(max_v) + 1
    new_mv = MapVersion(
        id=uuid.uuid4(),
        map_id=m.id,
        version=new_ver,
        width=draft.width,
        height=draft.height,
        unit=draft.unit,
        srid=draft.srid,
        is_published=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_mv)
    db.flush()

    id_map: dict[UUID, UUID] = {}
    old_nodes = list(
        db.execute(select(GraphNode).where(GraphNode.map_version_id == draft.id))
        .scalars()
        .all()
    )
    for n in old_nodes:
        new_id = uuid.uuid4()
        id_map[n.id] = new_id
        db.add(
            GraphNode(
                id=new_id,
                map_version_id=new_mv.id,
                external_id=n.external_id,
                node_type=n.node_type,
                label=n.label,
                geom=n.geom,
            )
        )
    db.flush()

    old_edges = list(
        db.execute(select(GraphEdge).where(GraphEdge.map_version_id == draft.id))
        .scalars()
        .all()
    )
    ext_old: dict[UUID, str] = {n.id: n.external_id for n in old_nodes}
    for e in old_edges:
        fn, tn = id_map.get(e.from_node_id), id_map.get(e.to_node_id)
        if not fn or not tn:
            continue
        db.add(
            GraphEdge(
                id=uuid.uuid4(),
                map_version_id=new_mv.id,
                from_node_id=fn,
                to_node_id=tn,
                weight=e.weight,
                path=e.path,
            )
        )
    db.flush()
    new_nodes = list(
        db.execute(select(GraphNode).where(GraphNode.map_version_id == new_mv.id))
        .scalars()
        .all()
    )
    ext_new: dict[UUID, str] = {n.id: n.external_id for n in new_nodes}
    new_edge_rows = list(
        db.execute(select(GraphEdge).where(GraphEdge.map_version_id == new_mv.id))
        .scalars()
        .all()
    )
    pair_to_new: dict[tuple[str, str], uuid.UUID] = {}
    for ne in new_edge_rows:
        a = ext_new.get(ne.from_node_id)
        b = ext_new.get(ne.to_node_id)
        if a and b:
            pair_to_new[(a, b)] = ne.id
    old_eids = [e.id for e in old_edges]
    old_lives = (
        db.execute(select(GraphEdgeLive).where(GraphEdgeLive.graph_edge_id.in_(old_eids)))
        .scalars()
        .all()
        if old_eids
        else []
    )
    for lv in old_lives:
        oe = next((x for x in old_edges if x.id == lv.graph_edge_id), None)
        if oe is None:
            continue
        oa, ob = ext_old.get(oe.from_node_id), ext_old.get(oe.to_node_id)
        if not oa or not ob:
            continue
        nuid = pair_to_new.get((oa, ob))
        if nuid is None:
            continue
        db.add(
            GraphEdgeLive(
                graph_edge_id=nuid,
                crowd_factor=lv.crowd_factor,
                is_closed=lv.is_closed,
                priority=lv.priority,
                updated_at=datetime.now(timezone.utc),
            )
        )

    old_shops = list(
        db.execute(select(Shop).where(Shop.map_version_id == draft.id))
        .scalars()
        .all()
    )
    old_to_new_shop: dict[UUID, UUID] = {}
    for s in old_shops:
        new_s = uuid.uuid4()
        new_loc = id_map.get(s.location_node_id)
        if not new_loc:
            continue
        old_to_new_shop[s.id] = new_s
        db.add(
            Shop(
                id=new_s,
                map_version_id=new_mv.id,
                external_id=s.external_id,
                name=s.name,
                category=s.category,
                location_node_id=new_loc,
                footprint=s.footprint,
                extra=dict(s.extra or {}),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )
    db.flush()

    for old_id, new_id in old_to_new_shop.items():
        for t in (
            db.execute(text("SELECT tag FROM shop_tag WHERE shop_id = :sid"), {"sid": str(old_id)})
            .mappings()
            .all()
        ):
            db.add(ShopTag(shop_id=new_id, tag=t["tag"]))

    m.published_map_version_id = new_mv.id
    m.status = "published"
    m.updated_at = datetime.now(timezone.utc)
    graph_cache.invalidate_map(m.id)
    return new_mv


def load_payload_for_routing(
    db: Session, m: VenueMap, map_version: MapVersion
) -> tuple[list[tuple[str, str, float, str | None]], dict[str, tuple[float, float]]]:
    """Edges (from_ext, to_ext, w, edge_uuid) and node coords for A* cache."""
    nodes = (
        db.execute(select(GraphNode).where(GraphNode.map_version_id == map_version.id))
        .scalars()
        .all()
    )
    coords: dict[str, tuple[float, float]] = {}
    for n in nodes:
        x, y = _to_xy(n.geom)
        coords[n.external_id] = (x, y)
    edges: list[tuple[str, str, float, str | None]] = []
    ext_by: dict[UUID, str] = {n.id: n.external_id for n in nodes}
    edge_rows = (
        db.execute(select(GraphEdge).where(GraphEdge.map_version_id == map_version.id))
        .scalars()
        .all()
    )
    eids = [e.id for e in edge_rows]
    live_by = edge_live_service.load_live_by_edge_ids(db, eids)
    for e in edge_rows:
        a, b = ext_by.get(e.from_node_id), ext_by.get(e.to_node_id)
        if not a or not b:
            continue
        lv = live_by.get(e.id)
        eff = edge_live_service.effective_routing_weight(e.weight, lv)
        if eff is None:
            continue
        if eff <= 0:
            continue
        edges.append((a, b, eff, str(e.id)))
    return edges, coords
