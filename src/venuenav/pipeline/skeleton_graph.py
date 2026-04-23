"""
Skeletonize walkable mask, keypoints (junctions/ends), trace centerline edges, width-weighted costs.
"""

from __future__ import annotations

import warnings
from typing import Any

import cv2
import numpy as np
from skimage.morphology import remove_small_objects, skeletonize

from venuenav.pipeline.text_extract import TextItem


def _n8(y: int, x: int, h: int, w: int) -> list[tuple[int, int]]:
    o: list[tuple[int, int]] = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                o.append((ny, nx))
    return o


def _deg(skel: np.ndarray, y: int, x: int, h: int, w: int) -> int:
    if not skel[y, x]:
        return 0
    return sum(1 for ny, nx in _n8(y, x, h, w) if skel[ny, nx])


def _keypoints(skel: np.ndarray, h: int, w: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    ys, xs = np.where(skel)
    for y, x in zip(ys, xs, strict=True):
        yi, xi = int(y), int(x)
        d = _deg(skel, yi, xi, h, w)
        if d != 2:
            out.add((yi, xi))
    return out


def _follow(
    skel: np.ndarray,
    h: int,
    w: int,
    start: tuple[int, int],
    first: tuple[int, int],
    keypoints: set[tuple[int, int]],
    dist: np.ndarray,
) -> tuple[tuple[int, int] | None, float, list[float]]:
    """Walk from `start` to `first` (adjacent on skeleton) until next keypoint."""
    py, px = first
    prev = start
    total = float(np.hypot(py - start[0], px - start[1]))
    widths: list[float] = [float(dist[py, px])]
    for _ in range(100_000):
        if (py, px) in keypoints and (py, px) != start and total > 0.25:
            return (py, px), total, widths
        nbrs = [n for n in _n8(py, px, h, w) if skel[n[0], n[1]] and n != prev]
        if len(nbrs) != 1:
            if (py, px) in keypoints and (py, px) != start:
                return (py, px), total, widths
            return None, 0.0, []
        ny, nx = nbrs[0]
        total += float(np.hypot(ny - py, nx - px))
        if 0 <= ny < h and 0 <= nx < w:
            widths.append(float(dist[ny, nx]))
        prev, (py, px) = (py, px), (ny, nx)
    return None, 0.0, []


def build_skeleton_suggestion(
    walkable: np.ndarray,
    ocr: list[TextItem],
    map_id: str,
    version_id: str,
    width: float,
    height: float,
) -> dict[str, Any] | None:
    """`walkable` should already be preprocessed (e.g. morphological close + smooth)."""
    wk = walkable if walkable.dtype == bool else walkable.astype(bool)
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=FutureWarning, message=".*min_size.*")
        wk = remove_small_objects(wk, min_size=40)
    if not wk.any():
        return None
    skel = skeletonize(wk)
    h, w2 = skel.shape
    if not skel.any() or h < 3 or w2 < 3:
        return None

    dist = cv2.distanceTransform(wk.astype(np.uint8), cv2.DIST_L2, 5).astype(np.float64)
    kps = _keypoints(skel, h, w2)
    if len(kps) < 2:
        return None

    seen: set[frozenset[tuple[int, int]]] = set()
    traced: list[tuple[tuple[int, int], tuple[int, int], float, float, list[float], float]] = []

    for p in kps:
        for n in _n8(p[0], p[1], h, w2):
            if not skel[n[0], n[1]]:
                continue
            end, plen, hws = _follow(skel, h, w2, p, n, kps, dist)
            if not end or plen < 0.1 or end not in kps:
                continue
            sig = frozenset({p, end})
            if sig in seen:
                continue
            seen.add(sig)
            mhw = float(np.mean(hws)) if hws else 4.0
            wgt = plen * (12.0 / (mhw + 2.0))
            conf = min(0.95, 0.5 + 0.5 * (mhw / (mhw + 6.0)))
            traced.append((p, end, plen, wgt, hws, conf))

    if len(traced) < 1:
        return None

    idx = 0
    pt_to: dict[tuple[int, int], str] = {}
    for p in sorted(kps, key=lambda t: (t[0], t[1])):
        pt_to[p] = f"sk_n_{idx}"
        idx += 1

    nodes: list[dict[str, Any]] = []
    nconf: dict[str, float] = {}
    for p, eid in pt_to.items():
        d0 = _deg(skel, p[0], p[1], h, w2)
        c = 0.78 if d0 == 2 else 0.88 if d0 in (1, 3) else 0.9
        nconf[eid] = c
        nodes.append(
            {
                "id": eid,
                "x": float(p[1]),
                "y": float(p[0]),
                "type": "intersection" if d0 >= 3 else "generic",
                "label": None,
            }
        )

    edges: list[dict[str, Any]] = []
    for i, (pa, pb, plen, wgt, hws, _econf) in enumerate(traced):
        ia, ib = pt_to[pa], pt_to[pb]
        eid = f"sk_e_{i}"
        edges.append({"from": ia, "to": ib, "weight": float(wgt), "edge_id": eid})

    def nearest_id(cx: float, cy: float) -> tuple[str | None, float]:
        best, bd = None, 1e18
        for n in nodes:
            d2 = (n["x"] - cx) ** 2 + (n["y"] - cy) ** 2
            if d2 < bd:
                bd = d2
                best = n["id"]
        return best, bd

    shops: list[dict[str, Any]] = []
    for i, t in enumerate(ocr):
        if not t.label:
            continue
        loc, d2 = nearest_id(t.x, t.y)
        if not loc:
            continue
        sc = 0.7 if d2 < 50 * 50 else 0.55
        shops.append(
            {
                "id": f"sug_s_{i}",
                "name": t.label,
                "location_node": loc,
                "category": "import",
                "tags": ["import", "skeleton", "ocr"],
                "metadata": {
                    "venuenav:import": {
                        "source": "skeleton",
                        "bbox": [t.x, t.y, t.w, t.h],
                        "shop_confidence": sc,
                    },
                },
            }
        )

    return {
        "map_id": map_id,
        "map_version_id": version_id,
        "width": width,
        "height": height,
        "unit": "pixel",
        "raster_url": None,
        "nodes": nodes,
        "edges": edges,
        "shops": shops,
        "annotations": {
            "node_confidence": nconf,
            "graph_mode": "skeleton",
        },
    }
