from __future__ import annotations

import json
import math
from typing import Any
from uuid import UUID

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from venuenav.common.dtos import RouteResponseDTO
from venuenav.common.errors import http_error
from venuenav.config.settings import get_settings
from venuenav.db.models import MapVersion, VenueMap
from venuenav.modules.graph import service as graph_service
from venuenav.modules.routing.astar import astar_shortest_path, build_undirected_adjacency
from venuenav.modules.routing.cache import build_cached_graph_from_rows, graph_cache, route_key


def resolve_published_version(db: Session, m: VenueMap, version: int | None) -> MapVersion:
    if m.published_map_version_id is None:
        raise http_error("Map not published", "NOT_FOUND", 404)
    if version is not None:
        mv = db.execute(
            select(MapVersion).where(
                MapVersion.map_id == m.id, MapVersion.version == version, MapVersion.is_published.is_(True)
            )
        ).scalar_one_or_none()
    else:
        mv = db.get(MapVersion, m.published_map_version_id)
    if mv is None:
        raise http_error("Version not found", "NOT_FOUND", 404)
    return mv


def _get_adj_and_coords(
    db: Session, m: VenueMap, mv: MapVersion
) -> tuple[dict, dict[str, tuple[float, float]]]:
    cached = graph_cache.get_routing(m.id, mv.version)
    if cached is not None:
        return cached.adj, cached.coords
    edges_tuples, coords = graph_service.load_payload_for_routing(db, m, mv)
    cg = build_cached_graph_from_rows(edges_tuples, coords)
    graph_cache.set_routing(m.id, mv.version, cg)
    return cg.adj, cg.coords


def route_between(
    db: Session,
    m: VenueMap,
    mv: MapVersion,
    r: redis.Redis,
    from_node: str,
    to_node: str,
) -> RouteResponseDTO:
    s = get_settings()
    ck = route_key(m.id, mv.version, from_node, to_node)
    raw = r.get(ck)
    if raw:
        return RouteResponseDTO.model_validate(json.loads(raw))

    adj, coords = _get_adj_and_coords(db, m, mv)
    res = astar_shortest_path(adj, coords, from_node, to_node)
    if res is None:
        raise http_error("No path between nodes", "NO_PATH", 404)
    path, edge_ids, total = res
    out = RouteResponseDTO(
        map_version_id=str(mv.id),
        from_node=from_node,
        to_node=to_node,
        nodes=path,
        edge_ids=[e for e in edge_ids if e is not None],
        total_cost=total,
    )
    r.setex(ck, s.route_cache_ttl_seconds, out.model_dump_json())
    return out


def route_multi(
    db: Session, m: VenueMap, mv: MapVersion, r: redis.Redis, stop_node_ids: list[str], optimize: bool
) -> dict[str, Any]:
    if len(stop_node_ids) < 2:
        raise http_error("At least two stops required", "BAD_REQUEST", 400)

    stops = list(stop_node_ids)
    if optimize:
        # Stub: order intermediate stops by nearest-neighbor in coordinate space
        _adj, coords = _get_adj_and_coords(db, m, mv)
        first, last = stops[0], stops[-1]
        mid = list(stops[1:-1])
        cur = first
        ordered_mid: list[str] = []
        while mid:
            def dist(a: str, b: str) -> float:
                if a not in coords or b not in coords:
                    return float("inf")
                xa, ya = coords[a]
                xb, yb = coords[b]
                return math.hypot(xa - xb, ya - yb)

            nxt = min(mid, key=lambda x: dist(cur, x))
            ordered_mid.append(nxt)
            mid.remove(nxt)
            cur = nxt
        stops = [first, *ordered_mid, last]

    segments: list[RouteResponseDTO] = []
    full_nodes: list[str] = []
    full_edges: list[str] = []
    cost = 0.0
    for a, b in zip(stops, stops[1:], strict=False):
        seg = route_between(db, m, mv, r, a, b)
        segments.append(seg)
        if not full_nodes:
            full_nodes.extend(seg.nodes)
        else:
            full_nodes.extend(seg.nodes[1:])
        full_edges.extend(seg.edge_ids)
        cost += seg.total_cost

    return {
        "map_version_id": str(mv.id),
        "from_node": stop_node_ids[0],
        "to_node": stop_node_ids[-1],
        "nodes": full_nodes,
        "edge_ids": full_edges,
        "total_cost": cost,
        "segment_routes": [s.model_dump() for s in segments],
    }
