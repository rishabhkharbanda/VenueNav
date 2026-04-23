"""Render PDF to RGB image, normalize for downstream CV."""

from __future__ import annotations

import io

import numpy as np


def render_pdf_to_rgb(pdf_bytes: bytes, page_index: int = 0, dpi: int = 150) -> tuple[np.ndarray, int, int]:
    """
    Returns RGB uint8, width, height (pixels). Uses page_index (0 = first page).
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_index < 0 or page_index >= len(doc):
        page_index = 0
    page = doc[page_index]
    mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    w, h = pix.width, pix.height
    arr = np.frombuffer(pix.samples, dtype=np.uint8)
    n = int(pix.n)
    if n == 3:
        arr = arr.reshape((h, w, 3))
    elif n == 4:
        arr = arr.reshape((h, w, 4))[:, :, :3]
    else:
        g = arr.reshape((h, w))
        arr = np.stack([g, g, g], axis=-1)
    doc.close()
    return arr, int(w), int(h)


def rgb_to_png_bytes(rgb: np.ndarray) -> bytes:
    from PIL import Image

    im = Image.fromarray(rgb, mode="RGB")
    b = io.BytesIO()
    im.save(b, format="PNG", optimize=True)
    return b.getvalue()
