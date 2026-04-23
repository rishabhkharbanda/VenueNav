"""
Zones from spatial clustering of OCR label centers, with convex-hull polygon when possible.
Falls back to padded bbox. Replaces old horizontal strip zones.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from shapely.geometry import MultiPoint, Polygon
from shapely.validation import make_valid

from venuenav.pipeline.text_extract import TextItem

_hall = re.compile(
    r"hall|foyer|atrium|wing|exhibit|level|pavilion|west|east|north|south|zone",
    re.I,
)


@dataclass
class ZoneOut:
    id: str
    label: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    polygon: list[tuple[float, float]] = field(default_factory=list)


def _uf_parent(parent: list[int], i: int) -> int:
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


def _uf_union(parent: list[int], a: int, b: int) -> None:
    ra, rb = _uf_parent(parent, a), _uf_parent(parent, b)
    if ra != rb:
        parent[ra] = rb


def _cluster_ocr(
    items: list[TextItem], im_w: int, im_h: int, max_clusters: int = 24
) -> list[list[TextItem]]:
    usable = [t for t in items if t.label and t.label.strip() and t.w > 0 and t.h > 0]
    if not usable:
        return []
    centers: list[tuple[float, float]] = [
        (float(t.x) + float(t.w) * 0.5, float(t.y) + float(t.h) * 0.5) for t in usable
    ]
    n = len(usable)
    eps = max(36.0, 0.045 * float(min(im_w, im_h)))
    eps2 = eps * eps
    parent = list(range(n))
    for i in range(n):
        for j in range(i + 1, n):
            dx = centers[i][0] - centers[j][0]
            dy = centers[i][1] - centers[j][1]
            if dx * dx + dy * dy <= eps2:
                _uf_union(parent, i, j)
    clusters: dict[int, list[TextItem]] = {}
    for i, t in enumerate(usable):
        r = _uf_parent(parent, i)
        clusters.setdefault(r, []).append(t)
    out = list(clusters.values())
    out.sort(key=lambda gs: -len(gs))
    return out[:max_clusters] if out else []


def _zone_label(g: list[TextItem], idx: int) -> str:
    for t in g:
        if _hall.search(t.label or ""):
            return t.label.strip()[:50]
    for t in g:
        s = (t.label or "").strip()
        if s and len(s) >= 2:
            return s[:50]
    return f"Area {idx + 1}"


def _hull_and_bbox(
    g: list[TextItem], im_w: int, im_h: int, pad: float
) -> tuple[tuple[float, float, float, float], list[tuple[float, float]]]:
    pts = [
        (float(t.x) + float(t.w) * 0.5, float(t.y) + float(t.h) * 0.5) for t in g if t.w and t.h
    ]
    if not pts:
        return (0.0, 0.0, float(im_w), float(im_h)), []
    if len(pts) == 1:
        x, y = pts[0]
        b = (
            max(0.0, x - pad),
            max(0.0, y - pad),
            min(float(im_w), x + pad),
            min(float(im_h), y + pad),
        )
        return b, []
    if len(pts) == 2:
        mp2 = MultiPoint(pts)
        h2 = mp2.convex_hull
        poly2: list[tuple[float, float]] = []
        if h2.geom_type == "LineString" and h2.length > 0:
            try:
                b2 = h2.buffer(12.0)
                if b2.geom_type == "Polygon" and not b2.is_empty:
                    p2 = make_valid(b2) if not b2.is_valid else b2
                    ps = p2.simplify(2.0, preserve_topology=True)  # type: ignore[union-attr]
                    poly2 = [
                        (float(t[0]), float(t[1])) for t in ps.exterior.coords[:-1]  # type: ignore[union-attr]
                    ]
            except Exception:
                poly2 = []
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        b = (
            max(0.0, min(xs) - pad),
            max(0.0, min(ys) - pad),
            min(float(im_w), max(xs) + pad),
            min(float(im_h), max(ys) + pad),
        )
        return b, poly2
    mp = MultiPoint(pts)
    hull = mp.convex_hull
    poly: list[tuple[float, float]] = []
    if hull.is_empty:
        pass
    elif hull.geom_type == "Polygon":
        p2 = make_valid(hull) if not hull.is_valid else hull
        ps = p2.simplify(2.0, preserve_topology=True)  # type: ignore[union-attr]
        coords = list(ps.exterior.coords[:-1])  # type: ignore[union-attr]
        poly = [(float(c[0]), float(c[1])) for c in coords]
    else:
        try:
            buf = hull.buffer(10.0)
            if buf.geom_type == "Polygon" and not buf.is_empty:
                p2 = make_valid(buf) if not buf.is_valid else buf
                ps = p2.simplify(2.0, preserve_topology=True)  # type: ignore[union-attr]
                coords = list(ps.exterior.coords[:-1])  # type: ignore[union-attr]
                poly = [(float(c[0]), float(c[1])) for c in coords]
        except Exception:
            poly = []
    xs = [p[0] for p in (poly or pts)]
    ys = [p[1] for p in (poly or pts)]
    b = (
        max(0.0, min(xs) - pad),
        max(0.0, min(ys) - pad),
        min(float(im_w), max(xs) + pad),
        min(float(im_h), max(ys) + pad),
    )
    return b, poly


def suggest_zones(
    items: list[TextItem], im_w: int, im_h: int, max_strips: int = 4
) -> list[ZoneOut]:
    _ = max_strips  # legacy API; clustering decides count
    if not items or im_w < 1 or im_h < 1:
        return []
    groups = _cluster_ocr(items, im_w, im_h)
    if not groups:
        return []
    out: list[ZoneOut] = []
    for i, g in enumerate(groups):
        b, poly = _hull_and_bbox(g, im_w, im_h, pad=18.0)
        label = _zone_label(g, i)
        if len(poly) >= 3:
            try:
                p0 = Polygon(poly)
                p2 = make_valid(p0) if not p0.is_valid else p0
                if p2.geom_type == "Polygon" and p2.exterior is not None:
                    poly = [(float(t[0]), float(t[1])) for t in p2.exterior.coords[:-1]]
            except Exception:
                poly = []
        out.append(ZoneOut(id=f"zone_{i + 1}", label=label, bbox=b, polygon=poly))
    return out
