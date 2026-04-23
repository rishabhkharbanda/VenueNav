from __future__ import annotations

import json
from dataclasses import dataclass
from threading import Lock
from typing import Any
from uuid import UUID

import redis

from venuenav.modules.routing.astar import EdgeRef, build_undirected_adjacency


@dataclass
class CachedGraph:
    adj: dict[str, list[EdgeRef]]
    coords: dict[str, tuple[float, float]]


class GraphCache:
    """Process-local LRU-style cache for published routing graphs; Redis for JSON payload."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._routing: dict[str, CachedGraph] = {}

    def routing_key(self, map_id: UUID, version: int) -> str:
        return f"{map_id}:{version}"

    def get_routing(self, map_id: UUID, version: int) -> CachedGraph | None:
        with self._lock:
            return self._routing.get(self.routing_key(map_id, version))

    def set_routing(self, map_id: UUID, version: int, data: CachedGraph) -> None:
        with self._lock:
            self._routing[self.routing_key(map_id, version)] = data

    def invalidate_map(self, map_id: UUID) -> None:
        with self._lock:
            prefix = f"{map_id}:"
            keys = [k for k in self._routing if k.startswith(prefix)]
            for k in keys:
                del self._routing[k]


graph_cache = GraphCache()


def payload_cache_get(r: redis.Redis, key: str) -> dict[str, Any] | None:
    raw = r.get(key)
    if not raw:
        return None
    return json.loads(raw)


def payload_cache_set(r: redis.Redis, key: str, payload: dict[str, Any], ttl: int) -> None:
    r.setex(key, ttl, json.dumps(payload, default=str))


def payload_key(map_id: UUID, version: int) -> str:
    return f"venuenav:payload:{map_id}:{version}"


def route_key(map_id: UUID, version: int, a: str, b: str) -> str:
    return f"route:{map_id}:{version}:{a}:{b}"


def build_cached_graph_from_rows(
    edges: list[tuple[str, str, float, str | None]],
    coords: dict[str, tuple[float, float]],
) -> CachedGraph:
    adj = build_undirected_adjacency(edges)
    return CachedGraph(adj=adj, coords=coords)
