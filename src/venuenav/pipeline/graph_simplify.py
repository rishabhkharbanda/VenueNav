"""Contract degree-2 collinear chain nodes; keeps routing topology, drops visual noise."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

EPS = 1.25
MIN_LEN = 0.1


def _collinear(
    ax: float,
    ay: float,
    px: float,
    py: float,
    bx: float,
    by: float,
) -> bool:
    return abs((px - ax) * (by - py) - (py - ay) * (bx - px)) <= EPS


def simplify_collinear_chains(
    g: dict[str, Any], protected: set[str] | None = None, max_passes: int = 5_000
) -> dict[str, Any]:
    protected = set(protected or set())
    nodes: dict[str, dict[str, Any]] = {n["id"]: dict(n) for n in g.get("nodes", [])}
    if len(nodes) < 3:
        return g
    adj: dict[str, dict[str, float]] = defaultdict(dict)
    for e in g.get("edges", []):
        a, b, w_ = e["from"], e["to"], float(e.get("weight", 1.0))
        if a not in nodes or b not in nodes or a == b:
            continue
        w0 = adj[a].get(b)
        if w0 is not None and w0 <= w_:
            continue
        adj[a][b] = w_
        adj[b][a] = w_

    # Edge id: keep one arbitrary edge_id for merged a-b
    eid_by_pair: dict[frozenset[str], str | None] = {}
    for e in g.get("edges", []):
        a, b = e.get("from"), e.get("to")
        if not a or not b or a not in nodes or b not in nodes:
            continue
        eid = e.get("edge_id")
        if eid is not None:
            eid_by_pair[frozenset({a, b})] = str(eid) if eid is not None else None

    passes = 0
    while passes < max_passes:
        passes += 1
        removed = False
        for nid in list(nodes):
            if nid in protected or len(adj.get(nid, {})) != 2:
                continue
            a, b = list(adj[nid])
            if a in protected or b in protected:
                continue
            p, p1, p2 = nodes[nid], nodes[a], nodes[b]
            if not _collinear(
                float(p1["x"]),
                float(p1["y"]),
                float(p["x"]),
                float(p["y"]),
                float(p2["x"]),
                float(p2["y"]),
            ):
                continue
            w_new = float(adj[nid][a]) + float(adj[nid][b])
            old_dir = adj[a].get(b)
            del adj[a][nid]
            del adj[nid][a]
            del adj[nid][b]
            del adj[b][nid]
            e_ab = eid_by_pair.get(frozenset({a, b}))
            if old_dir is not None:
                w_new = min(w_new, old_dir)
            adj[a][b] = w_new
            adj[b][a] = w_new
            if e_ab is not None:
                eid_by_pair[frozenset({a, b})] = e_ab
            del nodes[nid]
            del adj[nid]
            removed = True
            break
        if not removed:
            break

    g["nodes"] = list(nodes.values())
    seen: set[tuple[str, str]] = set()
    new_edges: list[dict[str, Any]] = []
    for a, nbrs in adj.items():
        for b, w in nbrs.items():
            p = (a, b) if a < b else (b, a)
            if p in seen:
                continue
            seen.add(p)
            w = float(w) if w and not math.isnan(w) and w >= MIN_LEN else 1.0
            eid = eid_by_pair.get(frozenset({a, b}))
            new_edges.append(
                {
                    "from": a,
                    "to": b,
                    "weight": w,
                    "edge_id": eid,
                }
            )
    g["edges"] = new_edges
    return g
