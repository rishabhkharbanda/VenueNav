from __future__ import annotations

import json
import logging
import math
import time
from typing import Any
from uuid import UUID

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from venuenav.common.dtos import RouteResponseDTO
from venuenav.common.errors import http_error
from venuenav.config.settings import get_settings
from venuenav.db.models import MapVersion, VenueMap
from venuenav.modules.graph import edge_live as edge_live_service
from venuenav.modules.graph import service as graph_service
from venuenav.modules.routing.astar import astar_shortest_path, build_undirected_adjacency
from venuenav.modules.routing.cache import build_cached_graph_from_rows, graph_cache, route_key

LOG = logging.getLogger("venuenav.routing")
_ROUTE_SLOW_MS = 200.0


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
    db: Session, m: VenueMap, mv: MapVersion, r: redis.Redis
) -> tuple[dict, dict[str, tuple[float, float]]]:
    epoch = edge_live_service.get_live_epoch(r, m.id)
    cached = graph_cache.get_routing(m.id, mv.version, epoch)
    if cached is not None:
        return cached.adj, cached.coords
    edges_tuples, coords = graph_service.load_payload_for_routing(db, m, mv)
    cg = build_cached_graph_from_rows(edges_tuples, coords)
    graph_cache.set_routing(m.id, mv.version, epoch, cg)
    return cg.adj, cg.coords


def route_between(
    db: Session,
    m: VenueMap,
    mv: MapVersion,
    r: redis.Redis,
    from_node: str,
    to_node: str,
) -> RouteResponseDTO:
    from venuenav.observability.metrics import (
        REDIS_ROUTE_CACHE,
        ROUTING_COMPUTE_SECONDS,
        ROUTING_OUTCOME,
    )

    s = get_settings()
    t_request = time.perf_counter()
    epoch = edge_live_service.get_live_epoch(r, m.id)
    ck = route_key(m.id, mv.version, epoch, from_node, to_node)
    raw = r.get(ck)
    if raw:
        REDIS_ROUTE_CACHE.labels(result="hit").inc()
        ROUTING_OUTCOME.labels(outcome="redis_cache_hit").inc()
        dto = RouteResponseDTO.model_validate(json.loads(raw))
        _log_route_timing(
            t_request, m.id, from_node, to_node, dto, "redis_hit", 0.0, 0.0
        )
        return dto
    REDIS_ROUTE_CACHE.labels(result="miss").inc()

    t_graph0 = time.perf_counter()
    adj, coords = _get_adj_and_coords(db, m, mv, r)
    ROUTING_COMPUTE_SECONDS.labels(phase="graph").observe(time.perf_counter() - t_graph0)
    graph_ms = (time.perf_counter() - t_graph0) * 1000.0
    t_astar0 = time.perf_counter()
    res = astar_shortest_path(adj, coords, from_node, to_node)
    ROUTING_COMPUTE_SECONDS.labels(phase="astar").observe(time.perf_counter() - t_astar0)
    astar_ms = (time.perf_counter() - t_astar0) * 1000.0
    if res is None:
        ROUTING_OUTCOME.labels(outcome="no_path").inc()
        LOG.info(
            "routing_no_path",
            extra={
                "event": "routing_no_path",
                "map_id": str(m.id),
                "from_node": from_node,
                "to_node": to_node,
            },
        )
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
    ROUTING_OUTCOME.labels(outcome="computed").inc()
    _log_route_timing(
        t_request, m.id, from_node, to_node, out, "computed", graph_ms, astar_ms
    )
    return out


def _log_route_timing(
    t0: float,
    map_id: Any,
    from_node: str,
    to_node: str,
    dto: RouteResponseDTO,
    mode: str,
    graph_ms: float,
    astar_ms: float,
) -> None:
    total_ms = (time.perf_counter() - t0) * 1000.0
    extra: dict = {
        "event": "route_computed" if mode != "redis_hit" else "route_cache_hit",
        "map_id": str(map_id),
        "from_node": from_node,
        "to_node": to_node,
        "latency_ms": round(total_ms, 2),
        "graph_ms": round(graph_ms, 2) if mode == "computed" else None,
        "astar_ms": round(astar_ms, 2) if mode == "computed" else None,
        "mode": mode,
        "total_cost": dto.total_cost,
    }
    if total_ms > _ROUTE_SLOW_MS and mode == "computed":
        LOG.warning("routing_slow", extra=extra)
    else:
        LOG.info("routing", extra=extra)


def route_multi(
    db: Session, m: VenueMap, mv: MapVersion, r: redis.Redis, stop_node_ids: list[str], optimize: bool
) -> dict[str, Any]:
    if len(stop_node_ids) < 2:
        raise http_error("At least two stops required", "BAD_REQUEST", 400)

    stops = list(stop_node_ids)
    if optimize:
        # Stub: order intermediate stops by nearest-neighbor in coordinate space
        _adj, coords = _get_adj_and_coords(db, m, mv, r)
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
