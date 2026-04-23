"""
Uniform edge direction vectors and coarse classification from final node geometry + distance field.
Call after all graph mutations (simplify, connectivity, entrance edges).
"""

from __future__ import annotations

import math
from typing import Any

import cv2
import numpy as np


def _classify_path_edges(
    rows: list[dict[str, Any]],
) -> None:
    """In-place: main_corridor vs secondary_path from length × width heuristics."""
    if not rows:
        return
    skippable = ("connectivity_bridge", "connector", "entrance_link")
    for_median = [r for r in rows if r.get("path_class") != "connectivity_bridge"]
    mhw = [float(r.get("mean_corridor_radius_px") or 3.0) for r in for_median]
    plen = [float(r.get("path_length_px") or 1.0) for r in for_median]
    scores_all = [m * math.log(1.0 + p) for m, p in zip(mhw, plen, strict=True)]
    med = float(np.median(scores_all)) if scores_all else 0.0
    score_by_id = {id(r): s for r, s in zip(for_median, scores_all, strict=True)}
    for r in rows:
        if r.get("path_class") in skippable:
            continue
        s = score_by_id.get(id(r), 0.0)
        m = float(r.get("mean_corridor_radius_px") or 3.0)
        c = min(0.95, 0.5 + 0.5 * (m / (m + 6.0)))
        r["confidence"] = c
        r["path_class"] = "main_corridor" if s >= med else "secondary_path"


def build_edge_metadata_for_graph(
    g: dict[str, Any],
    walk: np.ndarray | None,
    bridge_keys: set[frozenset[str]] | None = None,
) -> list[dict[str, Any]]:
    """
    Produces one row per undirected graph edge: dx, dy (unit in map pixels),
    path_length_px, mean_corridor_radius from distance transform at edge midpoint when walk is given.
    """
    wk = None
    dist: np.ndarray | None = None
    if walk is not None and walk.any():
        wk = walk if walk.dtype == bool else walk.astype(bool)
        dist = cv2.distanceTransform(wk.astype(np.uint8), cv2.DIST_L2, 5).astype(np.float64)

    by_id = {n["id"]: n for n in g.get("nodes", [])}
    seen: set[tuple[str, str]] = set()
    rows: list[dict[str, Any]] = []
    for e in g.get("edges", []):
        a, b = e.get("from"), e.get("to")
        if not a or not b or a not in by_id or b not in by_id:
            continue
        p1 = (a, b) if a < b else (b, a)
        if p1 in seen:
            continue
        seen.add(p1)
        na, nb = by_id[a], by_id[b]
        ax, ay = float(na["x"]), float(na["y"])
        bx, by = float(nb["x"]), float(nb["y"])
        ddx, ddy = bx - ax, by - ay
        plen = float(np.hypot(ddx, ddy)) or 0.0
        ln = plen if plen > 1e-6 else 1.0
        mhw = 4.0
        if dist is not None and wk is not None and plen > 0:
            mx, my = (ax + bx) * 0.5, (ay + by) * 0.5
            ix, iy = int(round(mx)), int(round(my))
            h, w2 = wk.shape
            if 0 <= iy < h and 0 <= ix < w2 and wk[iy, ix]:
                mhw = float(dist[iy, ix])
        row = {
            "from": a,
            "to": b,
            "path_length_px": plen,
            "mean_corridor_radius_px": mhw,
            "weight": float(e.get("weight", plen)),
            "confidence": 0.82,
            "dx": ddx / ln,
            "dy": ddy / ln,
        }
        fk = frozenset({a, b})
        if bridge_keys and fk in bridge_keys:
            row["path_class"] = "connectivity_bridge"
            row["confidence"] = 0.75
            row["mean_corridor_radius_px"] = 2.0
        rows.append(row)
    _classify_path_edges(rows)
    return rows
