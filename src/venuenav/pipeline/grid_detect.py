"""Estimate global 1m-style grid spacing in pixel space (autocorrelation of projections)."""

from __future__ import annotations

import numpy as np


def estimate_grid_spacing_px(mask: np.ndarray) -> dict | None:
    """
    Detect dominant line spacing from row/column projections of edges.
    Returns { "spacing_px": float, "confidence": float } or None.
    """
    import cv2

    m = (mask.astype(np.uint8) * 255) if mask.dtype != np.uint8 else mask
    edges = cv2.Canny(m, 50, 150)
    col = edges.sum(axis=0).astype(np.float64)
    row = edges.sum(axis=1).astype(np.float64)
    col -= col.mean()
    row -= row.mean()
    if col.std() < 1e-6 or row.std() < 1e-6:
        return None

    def first_peak_dist(sig: np.ndarray) -> float | None:
        r = np.correlate(sig, sig, mode="full")
        mid = len(r) // 2
        r = r[mid + 1 :]
        if len(r) < 8:
            return None
        peak = int(np.argmax(r[8:])) + 8
        if peak <= 0:
            return None
        return float(peak)

    dx = first_peak_dist(col)
    dy = first_peak_dist(row)
    if dx is None and dy is None:
        return None
    sp = (dx + dy) / 2.0 if dx and dy else (dx or dy)
    if sp is None or sp < 8 or sp > min(mask.shape[0], mask.shape[1]) / 3:
        return None
    return {"spacing_px": sp, "confidence": 0.4, "spacing_x": dx, "spacing_y": dy}
