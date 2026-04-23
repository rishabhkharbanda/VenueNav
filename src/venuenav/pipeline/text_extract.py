"""Extract text positions from PDF vector text (primary) or image bounding boxes."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TextItem:
    label: str
    x: float
    y: float
    w: float
    h: float


def extract_text_from_pdf(
    pdf_bytes: bytes, page_index: int = 0
) -> tuple[list[TextItem], float, float]:
    """
    PyMuPDF text — positions in **page space** (72 dpi). Caller maps to raster pixels.
    """
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_index < 0 or page_index >= len(doc):
        page_index = 0
    page = doc[page_index]
    rect = page.rect
    out: list[TextItem] = []
    try:
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE).get("blocks", [])
    except TypeError:
        blocks = page.get_text("dict").get("blocks", [])
    for b in blocks:
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            for sp in line.get("spans", []):
                txt = (sp.get("text") or "").strip()
                if len(txt) < 1:
                    continue
                bb = sp.get("bbox")
                if not bb or len(bb) < 4:
                    continue
                x0, y0, x1, y1 = bb[0], bb[1], bb[2], bb[3]
                out.append(
                    TextItem(
                        label=txt[:200],
                        x=(x0 + x1) * 0.5,
                        y=(y0 + y1) * 0.5,
                        w=max(0.0, x1 - x0),
                        h=max(0.0, y1 - y0),
                    )
                )
    doc.close()
    return out, float(rect.width), float(rect.height)


def map_pdf_points_to_raster(
    items: list[TextItem], pdf_w: float, pdf_h: float, im_w: int, im_h: int
) -> list[TextItem]:
    if pdf_w < 1e-6 or pdf_h < 1e-6:
        return items
    sx = im_w / pdf_w
    sy = im_h / pdf_h
    out: list[TextItem] = []
    for t in items:
        out.append(
            TextItem(
                label=t.label,
                x=t.x * sx,
                y=t.y * sy,
                w=t.w * sx,
                h=t.h * sy,
            )
        )
    return out
