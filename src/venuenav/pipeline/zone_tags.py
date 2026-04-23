"""Map node / shop positions to OCR-based zones (bbox or convex polygon)."""

from __future__ import annotations

from typing import Any

from shapely.geometry import Point, Polygon


def _in_zone(x: float, y: float, z: dict[str, Any]) -> bool:
    poly = z.get("polygon")
    if isinstance(poly, list) and len(poly) >= 3:
        try:
            pairs = [(float(t[0]), float(t[1])) for t in poly]
            p2 = Polygon(pairs)
            pt = Point(x, y)
            return bool(p2.covers(pt) or p2.touches(pt))
        except Exception:
            pass
    bb = z.get("bbox") or []
    if len(bb) < 4:
        return False
    x0, y0, x1, y1 = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
    return x0 <= x < x1 and y0 <= y < y1


def node_zone_ids(nodes: list[dict[str, Any]], zones: list[dict[str, Any]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for n in nodes:
        x, y = float(n["x"]), float(n["y"])
        nid = str(n["id"])
        for z in zones:
            if _in_zone(x, y, z):
                out[nid] = str(z["id"])
                break
    return out


def tag_shop_zone_metadata(shops: list[dict[str, Any]], zones: list[dict[str, Any]]) -> None:
    for s in shops:
        imp = (s.get("metadata") or {}).get("venuenav:import", {}) or {}
        b = imp.get("bbox", [])
        if not isinstance(b, list) or len(b) < 4:
            continue
        cx = float(b[0]) + float(b[2]) * 0.5
        cy = float(b[1]) + float(b[3]) * 0.5
        for z in zones:
            if _in_zone(cx, cy, z):
                imp2 = dict(imp)
                imp2["zone_id"] = str(z["id"])
                sm = dict(s.get("metadata") or {})
                sm["venuenav:import"] = imp2
                s["metadata"] = sm
                break
