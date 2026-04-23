"""Merge disconnected graph components by adding bridges (nearest node pairs)."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

import numpy as np


def _components(
    node_ids: set[str], undirected: dict[str, set[str]]
) -> list[set[str]]:
    seen: set[str] = set()
    comps: list[set[str]] = []
    for n in node_ids:
        if n in seen:
            continue
        stack = [n]
        comp: set[str] = set()
        while stack:
            u = stack.pop()
            if u in seen or u not in node_ids:
                continue
            seen.add(u)
            comp.add(u)
            for v in undirected.get(u, ()):
                if v in node_ids and v not in seen:
                    stack.append(v)
        if comp:
            comps.append(comp)
    return comps


def _node_pos(g: dict[str, Any]) -> dict[str, tuple[float, float]]:
    return {n["id"]: (float(n["x"]), float(n["y"])) for n in g.get("nodes", [])}


def _undirected(g: dict[str, Any], node_ids: set[str]) -> dict[str, set[str]]:
    u: dict[str, set[str]] = defaultdict(set)
    for e in g.get("edges", []):
        a, b = e.get("from"), e.get("to")
        if not a or not b or a not in node_ids or b not in node_ids or a == b:
            continue
        u[a].add(b)
        u[b].add(a)
    return u


def connect_components_nearest(
    g: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Repeatedly add an edge between the pair of nodes in *different* components
    with minimum distance until the graph is connected.
    """
    by_id = _node_pos(g)
    if len(by_id) < 2:
        return []
    all_ids = set(by_id)
    bridges: list[dict[str, Any]] = []
    bridge_i = 0

    while True:
        und = _undirected(g, all_ids)
        comps = _components(all_ids, und)
        if len(comps) <= 1:
            break
        best: tuple[float, str, str] | None = None
        for i, ci in enumerate(comps):
            for cj in comps[i + 1 :]:
                for a in ci:
                    ax, ay = by_id[a]
                    for b in cj:
                        bx, by = by_id[b]
                        d2 = (ax - bx) ** 2 + (ay - by) ** 2
                        if best is None or d2 < best[0]:
                            best = (d2, a, b)
        if not best:
            break
        _, a, b = best
        wgt = float(math.sqrt(best[0])) if best[0] > 0 else 0.5
        wgt = max(0.5, wgt)
        eid = f"bridge_{bridge_i}"
        bridge_i += 1
        g["edges"].append(
            {
                "from": a,
                "to": b,
                "weight": wgt,
                "edge_id": eid,
            }
        )
        ax, ay = by_id[a]
        bx, by = by_id[b]
        ddx, ddy = bx - ax, by - ay
        ln = float(np.hypot(ddx, ddy)) or 1.0
        bridges.append(
            {
                "from": a,
                "to": b,
                "path_length_px": wgt,
                "mean_corridor_radius_px": 2.0,
                "weight": wgt,
                "confidence": 0.75,
                "path_class": "connectivity_bridge",
                "dx": ddx / ln,
                "dy": ddy / ln,
            }
        )
    return bridges
