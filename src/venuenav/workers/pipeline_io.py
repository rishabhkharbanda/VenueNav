"""Download PDF for processing; provide a synthetic PDF when the stored URL is a stub."""

from __future__ import annotations

import httpx


def fetch_pdf_bytes(url: str) -> bytes:
    u = (url or "").lower()
    if u.startswith("stub://") or "placeholder" in u:
        return _minimal_demo_pdf()
    with httpx.Client(follow_redirects=True, timeout=120.0) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.content


def _minimal_demo_pdf() -> bytes:
    import fitz

    d = fitz.open()
    p = d.new_page(width=800, height=1100)
    p.insert_text((50, 80), "HALL 2", fontsize=14)
    p.insert_text((100, 200), "A-01  A-02  A-03", fontsize=10)
    p.insert_text((100, 500), "TOILET  LIFT", fontsize=9)
    p.draw_line((50, 150), (750, 150))
    p.draw_line((50, 350), (750, 350))
    b = d.tobytes()
    d.close()
    return b
