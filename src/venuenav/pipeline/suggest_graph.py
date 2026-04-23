"""
Build a suggested graph from walkable mask: prefer skeleton (centerline) graph, else grid;
optional collinear simplification; shop_entry nodes on walkable boundary.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from venuenav.pipeline.connectivity import connect_components_nearest
from venuenav.pipeline.edge_metadata import build_edge_metadata_for_graph
from venuenav.pipeline.graph_simplify import simplify_collinear_chains
from venuenav.pipeline.shop_entrance import attach_shop_entrances
from venuenav.pipeline.skeleton_mask import preprocess_walkable_for_skeleton
from venuenav.pipeline.skeleton_graph import build_skeleton_suggestion
from venuenav.pipeline.text_extract import TextItem


def _iter_step(n: int, min_step: int) -> int:
    return int(max(min_step, n // 40))


def build_grid_graph(
    walkable: np.ndarray,
    ocr: list[TextItem],
    spacing_hint: float | None,
    map_id: str,
    version_id: str,
    width: float,
    height: float,
) -> dict[str, Any]:
    """
    Returns a dict suitable for front-end / MapPayload: nodes, edges, shops in pixel units.
    """
    h, w = walkable.shape[:2]
    step = int(spacing_hint) if (spacing_hint and 8 < spacing_hint < min(w, h) // 2) else _iter_step(min(w, h), 32)

    max_nodes = 420
    while True:
        node_at: dict[tuple[int, int], str] = {}
        node_positions: list[tuple[str, float, float]] = []
        xs = list(range(step // 2, w, step))
        ys = list(range(step // 2, h, step))
        for iy, y in enumerate(ys):
            for ix, x in enumerate(xs):
                if 0 <= y < h and 0 <= x < w and walkable[y, x]:
                    i = len(node_positions)
                    nid = f"sug_n_{i}"
                    node_positions.append((nid, float(x), float(y)))
                    node_at[(ix, iy)] = nid
        if len(node_positions) <= max_nodes or step > min(w, h) // 2:
            break
        step = int(step * 1.35) + 1

    nodes: list[dict[str, Any]] = []
    for nid, x, y in node_positions:
        nodes.append(
            {
                "id": nid,
                "x": x,
                "y": y,
                "type": "generic",
                "label": None,
            }
        )

    edges: list[dict[str, Any]] = []
    seen: set[str] = set()
    for (ix, iy), na in list(node_at.items()):
        for dx, dy, dist in ((1, 0, step), (0, 1, step), (-1, 0, step), (0, -1, step)):
            nb = node_at.get((ix + dx, iy + dy))
            if not nb or na == nb:
                continue
            a, b = sorted((na, nb))
            key = f"{a}::{b}"
            if key in seen:
                continue
            seen.add(key)
            wgt = dist if (dx, dy) in ((1, 0), (0, 1), (-1, 0), (0, -1)) else dist * 1.414
            edges.append({"from": a, "to": b, "weight": float(wgt), "edge_id": None})

    def nearest_node(nx: float, ny: float) -> str | None:
        best: tuple[str, float] | None = None
        for nid, x, y in node_positions:
            d2 = (x - nx) ** 2 + (y - ny) ** 2
            if best is None or d2 < best[1]:
                best = (nid, d2)
        if not best:
            return None
        if best[1] < (step * 4) ** 2:
            return best[0]
        return best[0] if best[1] < (step * 6) ** 2 else None

    shops: list[dict[str, Any]] = []
    for i, t in enumerate(ocr):
        if len(t.label) < 1:
            continue
        loc = nearest_node(t.x, t.y)
        if not loc:
            continue
        shops.append(
            {
                "id": f"sug_s_{i}",
                "name": t.label,
                "location_node": loc,
                "category": "import",
                "tags": ["import", "ocr"],
                "metadata": {
                    "venuenav:import": {"source": "pdf_text", "bbox": [t.x, t.y, t.w, t.h]},
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
    }


def build_suggested_graph(
    walkable: np.ndarray,
    ocr: list[TextItem],
    spacing_hint: float | None,
    map_id: str,
    version_id: str,
    width: float,
    height: float,
) -> tuple[dict[str, Any], str, dict[str, Any] | None]:
    """
    Returns: (suggested map dict, graph_mode, skeleton annotations or None).
    The suggested dict is always MapPayload-shaped (no pipeline-only keys); annotations for skeleton
    (confidence, width meta) are returned separately to merge into import_artifact.
    """
    wk = preprocess_walkable_for_skeleton(walkable)
    sk = build_skeleton_suggestion(wk, ocr, map_id, version_id, width, height)

    if sk and len(sk.get("edges", ())) > 0:
        ann: dict[str, Any] | None = sk.pop("annotations", None)  # type: ignore[assignment]
        ann = ann or {}
        protected = {str(s["location_node"]) for s in sk.get("shops", []) if s.get("location_node")}
        simplify_collinear_chains(sk, protected=protected)
        bridges = connect_components_nearest(sk)
        if bridges:
            ann["connectivity_bridges"] = bridges
        bkeys = {frozenset({b["from"], b["to"]}) for b in bridges}
        attach_shop_entrances(sk, wk, ocr, use_edge_midpoint=True)
        ann["edges_detail"] = build_edge_metadata_for_graph(sk, wk, bridge_keys=bkeys)
        return sk, "skeleton", ann

    g = build_grid_graph(
        walkable, ocr, spacing_hint, map_id, version_id, width, height
    )
    ann_g: dict[str, Any] = {"graph_mode": "grid"}
    bridges_g = connect_components_nearest(g)
    if bridges_g:
        ann_g["connectivity_bridges"] = bridges_g
    bkeys_g = {frozenset({b["from"], b["to"]}) for b in bridges_g}
    attach_shop_entrances(g, walkable, ocr, use_edge_midpoint=True)
    ann_g["edges_detail"] = build_edge_metadata_for_graph(
        g, walkable, bridge_keys=bkeys_g
    )
    return g, "grid", ann_g
