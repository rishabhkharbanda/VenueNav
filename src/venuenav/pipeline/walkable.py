"""Segment walkable (light) vs blocked (stalls, walls) areas."""

from __future__ import annotations

import numpy as np


def walkable_mask_rgb(rgb: np.ndarray) -> np.ndarray:
    """
    Returns boolean mask: True = likely walkable corridor.
    Heuristic: light floor (high luminance), optional dark outline for contrast.
    """
    import cv2

    if rgb.dtype != np.uint8:
        rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    # Otsu global threshold — map mostly light background
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # If mean is low (dark scan), invert
    if gray.mean() < 120:
        th = 255 - th
    walk = th > 127
    # Cleanup: close small gaps, remove speckle
    walk_u8 = walk.astype(np.uint8) * 255
    walk_u8 = cv2.morphologyEx(walk_u8, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    walk_u8 = cv2.morphologyEx(walk_u8, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return walk_u8 > 127
