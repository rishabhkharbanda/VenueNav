"""A* shortest path on an undirected weighted graph (external_id node keys)."""

from __future__ import annotations

import heapq
import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class EdgeRef:
    to: str
    weight: float
    edge_id: str | None = None


def build_undirected_adjacency(
    edges: Iterable[tuple[str, str, float, str | None]],
) -> dict[str, list[EdgeRef]]:
    """Edges as (from_ext, to_ext, weight, optional_edge_uuid)."""
    adj: dict[str, list[EdgeRef]] = defaultdict(list)
    for a, b, w, eid in edges:
        if w <= 0:
            continue
        r = EdgeRef(to=b, weight=w, edge_id=eid)
        r2 = EdgeRef(to=a, weight=w, edge_id=eid)
        adj[a].append(r)
        adj[b].append(r2)
    return dict(adj)


def astar_shortest_path(
    adj: dict[str, list[EdgeRef]],
    coords: dict[str, tuple[float, float]],
    start: str,
    goal: str,
) -> tuple[list[str], list[str | None], float] | None:
    """
    Returns (node_ids_order, edge_ids_parallel, total_cost) or None if unreachable.
    edge_ids has length len(nodes)-1, entries may be None if not tracked.
    """
    if start == goal:
        return [start], [], 0.0
    if start not in adj or goal not in coords:
        return None

    def h(n: str) -> float:
        if n not in coords or goal not in coords:
            return 0.0
        x1, y1 = coords[n]
        x2, y2 = coords[goal]
        return math.hypot(x2 - x1, y2 - y1)

    open_heap: list[tuple[float, str]] = []
    heapq.heappush(open_heap, (h(start), start))
    g_score: dict[str, float] = defaultdict(lambda: math.inf)
    g_score[start] = 0.0
    came_from: dict[str, tuple[str, str | None]] = {}
    closed: set[str] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current in closed:
            continue
        if current == goal:
            path: list[str] = [current]
            edges: list[str | None] = []
            while current != start:
                prev, eid = came_from[current]
                path.append(prev)
                edges.append(eid)
                current = prev
            path.reverse()
            edges.reverse()
            total = g_score[goal]
            return path, edges, total

        closed.add(current)
        for edge in adj.get(current, []):
            nb = edge.to
            tentative = g_score[current] + edge.weight
            if tentative < g_score[nb]:
                came_from[nb] = (current, edge.edge_id)
                g_score[nb] = tentative
                f = tentative + h(nb)
                heapq.heappush(open_heap, (f, nb))

    return None
