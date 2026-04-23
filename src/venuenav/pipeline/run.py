"""Run the full import pipeline: raster → mask → text → suggest graph (skeleton or grid) + zones."""

from __future__ import annotations

import uuid
from typing import Any

from venuenav.pipeline.grid_detect import estimate_grid_spacing_px
from venuenav.pipeline.rasterize import render_pdf_to_rgb, rgb_to_png_bytes
from venuenav.pipeline.semantic_ocr import annotate_ocr_list
from venuenav.pipeline.suggest_graph import build_suggested_graph
from venuenav.pipeline.text_extract import map_pdf_points_to_raster, extract_text_from_pdf
from venuenav.pipeline.walkable import walkable_mask_rgb
from venuenav.pipeline.zone_tags import node_zone_ids, tag_shop_zone_metadata
from venuenav.pipeline.zones_from_ocr import suggest_zones

PIPELINE_VERSION = "v3"


def run_pdf_import(
    pdf_bytes: bytes, map_id: str, draft_version_id: str, dpi: int = 150
) -> dict[str, Any]:
    """
    Returns:
      { "png_bytes": bytes, "width": w, "height": h, "import_artifact": { ... } }
    """
    rgb, w, h = render_pdf_to_rgb(pdf_bytes, page_index=0, dpi=dpi)
    walk = walkable_mask_rgb(rgb)
    grid = estimate_grid_spacing_px(walk)
    spacing = float(grid["spacing_px"]) if grid else None

    items, pdf_w, pdf_h = extract_text_from_pdf(pdf_bytes, 0)
    ocr = map_pdf_points_to_raster(items, pdf_w, pdf_h, w, h)
    zone_rows = suggest_zones(ocr, w, h)
    zones = [
        {
            "id": z.id,
            "label": z.label,
            "bbox": [float(b) for b in z.bbox],
            "polygon": [[float(p[0]), float(p[1])] for p in z.polygon] if z.polygon else [],
        }
        for z in zone_rows
    ]

    suggest, graph_mode, skeleton_ann = build_suggested_graph(
        walk,
        ocr,
        spacing,
        str(map_id),
        str(draft_version_id),
        float(w),
        float(h),
    )
    tag_shop_zone_metadata(suggest.get("shops", []), zones)
    node_zmap = node_zone_ids(suggest.get("nodes", []), zones)
    suggested_annotations: dict[str, Any] = {
        "graph_mode": graph_mode,
        "node_zone_id": node_zmap,
    }
    if skeleton_ann:
        suggested_annotations.update(skeleton_ann)

    ocr_out = [
        {
            "label": t.label,
            "x": t.x,
            "y": t.y,
            "w": t.w,
            "h": t.h,
        }
        for t in ocr
    ]
    ocr_semantic = annotate_ocr_list(ocr)
    import_artifact: dict[str, Any] = {
        "pipeline": PIPELINE_VERSION,
        "job": str(uuid.uuid4()),
        "width_px": w,
        "height_px": h,
        "dpi": dpi,
        "grid": grid,
        "ocr": ocr_out,
        "ocr_semantic": ocr_semantic,
        "zones": zones,
        "suggested": suggest,
        "suggested_annotations": suggested_annotations,
    }
    return {
        "png_bytes": rgb_to_png_bytes(rgb),
        "width": w,
        "height": h,
        "import_artifact": import_artifact,
    }
