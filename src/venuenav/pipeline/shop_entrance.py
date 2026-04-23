"""
Shop entry nodes: prefer midpoint of the nearest graph edge (skeleton / grid),
else nearest walkable boundary. Connects the entry to the closer endpoint of that edge.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from venuenav.pipeline.text_extract import TextItem


def _pt_seg_dist_sq(
    px: float, py: float, x1: float, y1: float, x2: float, y2: float
) -> float:
    vx, vy = x2 - x1, y2 - y1
    w = (px - x1) * vx + (py - y1) * vy
    if w <= 0:
        ddx, ddy = px - x1, py - y1
        return ddx * ddx + ddy * ddy
    c = vx * vx + vy * vy
    if w >= c:
        ddx, ddy = px - x2, py - y2
        return ddx * ddx + ddy * ddy
    t = w / c
    qx, qy = x1 + t * vx, y1 + t * vy
    ddx, ddy = px - qx, py - qy
    return ddx * ddx + ddy * ddy


def _nearest_edge_midpoint(
    g: dict[str, Any], cx: float, cy: float, max_d2: float
) -> tuple[float, float, str, str] | None:
    by_id: dict[str, dict[str, Any]] = {n["id"]: n for n in g.get("nodes", [])}
    best_d2: float = max_d2
    out: tuple[float, float, str, str] | None = None
    for e in g.get("edges", ()):
        a, b = e.get("from"), e.get("to")
        if not a or not b:
            continue
        na, nb = by_id.get(a), by_id.get(b)
        if not na or not nb:
            continue
        x1, y1, x2, y2 = float(na["x"]), float(na["y"]), float(nb["x"]), float(nb["y"])
        d2 = _pt_seg_dist_sq(cx, cy, x1, y1, x2, y2)
        if d2 < best_d2:
            best_d2 = d2
            mx, my = 0.5 * (x1 + x2), 0.5 * (y1 + y2)
            out = (mx, my, str(a), str(b))
    return out


def _is_boundary4(walk: np.ndarray, y: int, x: int) -> bool:
    h, w2 = walk.shape
    if not walk[y, x]:
        return False
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if ny < 0 or nx < 0 or ny >= h or nx >= w2 or not walk[ny, nx]:
            return True
    return False


def _nearest_boundary_point(
    walk: np.ndarray, cx: float, cy: float, radius: int = 220
) -> tuple[int, int] | None:
    h, w2 = walk.shape
    ix, iy = int(round(cx)), int(round(cy))
    x0, x1 = max(0, ix - radius), min(w2, ix + radius + 1)
    y0, y1 = max(0, iy - radius), min(h, iy + radius + 1)
    best: tuple[int, int] | None = None
    bd = 1e18
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not walk[y, x] or not _is_boundary4(walk, y, x):
                continue
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d < bd:
                bd, best = d, (y, x)
    return best


def attach_shop_entrances(
    g: dict[str, Any],
    walk: np.ndarray,
    ocr: list[TextItem],
    *,
    use_edge_midpoint: bool = True,
) -> None:
    wk = walk if walk.dtype == bool else walk.astype(bool)
    by_id: dict[str, dict[str, Any]] = {n["id"]: n for n in g.get("nodes", [])}
    taken_entry: set[tuple[int, int]] = set()
    wimg, himg = float(wk.shape[1]), float(wk.shape[0])
    max_edge_d2 = (max(120.0, 0.35 * min(wimg, himg))) ** 2

    for shop in g.get("shops", []):
        old = str(shop.get("location_node") or "")
        if not old or old not in by_id:
            continue
        sid = str(shop.get("id", ""))
        idx = 0
        if sid.startswith("sug_s_"):
            try:
                idx = int(sid.split("_")[-1])
            except ValueError:
                idx = 0
        o = ocr[idx] if 0 <= idx < len(ocr) else None
        imp = (shop.get("metadata") or {}).get("venuenav:import", {}) or {}
        b = imp.get("bbox", [])
        if o is not None and isinstance(b, list) and len(b) >= 4:
            cx = float(b[0]) + float(b[2]) * 0.5
            cy = float(b[1]) + float(b[3]) * 0.5
        elif o is not None:
            cx, cy = float(o.x) + float(o.w) * 0.5, float(o.y) + float(o.h) * 0.5
        else:
            cx, cy = float(by_id[old]["x"]), float(by_id[old]["y"])

        edge_hit = (
            _nearest_edge_midpoint(g, cx, cy, max_edge_d2)
            if use_edge_midpoint
            else None
        )
        ex: float
        ey: float
        link_to: str
        wgt: float

        if edge_hit is not None:
            mx, my, a, b = edge_hit
            ex, ey = mx, my
            nax, nay = float(by_id[a]["x"]), float(by_id[a]["y"])
            nbx, nby = float(by_id[b]["x"]), float(by_id[b]["y"])
            da2 = (ex - nax) ** 2 + (ey - nay) ** 2
            db2 = (ex - nbx) ** 2 + (ey - nby) ** 2
            if da2 <= db2:
                link_to, wgt = a, max(0.5, float(np.sqrt(da2)))
            else:
                link_to, wgt = b, max(0.5, float(np.sqrt(db2)))
        else:
            bp = _nearest_boundary_point(wk, cx, cy)
            if not bp:
                continue
            by, bx = bp
            ex, ey = float(bx), float(by)
            key = (by // 2, bx // 2)
            if key in taken_entry:
                continue
            taken_entry.add(key)
            link_to = old
            wgt = max(
                0.5,
                float(
                    np.hypot(
                        float(by_id[old]["x"]) - ex,
                        float(by_id[old]["y"]) - ey,
                    )
                ),
            )

        eid: str | None = None
        for n in g["nodes"]:
            if n.get("type") == "shop_entry" and abs(n["x"] - ex) < 2.5 and abs(n["y"] - ey) < 2.5:
                eid = n["id"]
                break
        if eid is None:
            eid = f"ent_{sid}"
            while any(n["id"] == eid for n in g["nodes"]):
                eid = f"{eid}_x"
            g["nodes"].append(
                {
                    "id": eid,
                    "x": ex,
                    "y": ey,
                    "type": "shop_entry",
                    "label": None,
                }
            )
            by_id[eid] = g["nodes"][-1]

        pair = {eid, link_to}
        dup = any(
            {e.get("from"), e.get("to")} == pair for e in (g.get("edges") or [])
        )
        if not dup:
            g["edges"].append(
                {
                    "from": eid,
                    "to": link_to,
                    "weight": wgt,
                    "edge_id": None,
                }
            )
        imp2 = dict(imp)
        imp2["entrance_node"] = eid
        imp2["anchor"] = [cx, cy]
        imp2["entrance_mode"] = (
            "skeleton_edge_mid" if edge_hit is not None else "walk_boundary"
        )
        sm = dict(shop.get("metadata") or {})
        sm["venuenav:import"] = imp2
        shop["metadata"] = sm
        shop["location_node"] = eid
