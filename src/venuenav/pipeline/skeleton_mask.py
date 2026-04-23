"""Morphological closing + light smoothing to stabilize skeletonization."""

from __future__ import annotations

import cv2
import numpy as np


def preprocess_walkable_for_skeleton(walk: np.ndarray) -> np.ndarray:
    """
    Close gaps, remove speckle, lightly smooth mask boundaries before skeletonize.
    Reduces broken centerlines and spurs from noisy binarization.
    """
    wk = walk if walk.dtype == bool else walk.astype(bool)
    if not wk.any():
        return wk
    u8 = (wk.astype(np.uint8) * 255)
    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    closed = cv2.morphologyEx(u8, cv2.MORPH_CLOSE, k5, iterations=1)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, k3, iterations=1)
    blur = cv2.GaussianBlur(opened, (0, 0), sigmaX=1.2, sigmaY=1.2)
    _, th = cv2.threshold(blur, 127, 255, cv2.THRESH_BINARY)
    return th > 0
