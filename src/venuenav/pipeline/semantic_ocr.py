"""Classify raw OCR text into amenity / semantic categories (toilets, lifts, exits, ramps)."""

from __future__ import annotations

import re
from enum import StrEnum

from venuenav.pipeline.text_extract import TextItem


class AmenityType(StrEnum):
    TOILET = "toilet"
    LIFT = "lift"
    EXIT = "exit"
    RAMP = "ramp"
    OTHER = "other"


_TOILET = re.compile(
    r"toilet|restroom|washroom|wc\b|bathroom|gents|ladies|urinal|loo\b",
    re.I,
)
_LIFT = re.compile(r"lift|elevator|escalat", re.I)
_EXIT = re.compile(r"exit|fire exit|emergency|way out|evacuation", re.I)
_RAMP = re.compile(r"ramp|wheelchair|access\s+way|accessible", re.I)
_STALL = re.compile(r"^[A-Z]{1,2}[-\s]?\d{1,3}[a-z]?$", re.I)  # A-01, B 12
_STALL2 = re.compile(r"^stall\s*#?\d", re.I)


def classify_ocr_text(text: str) -> AmenityType:
    t = (text or "").strip()
    if not t or len(t) > 200:
        return AmenityType.OTHER
    if _TOILET.search(t):
        return AmenityType.TOILET
    if _LIFT.search(t):
        return AmenityType.LIFT
    if _EXIT.search(t):
        return AmenityType.EXIT
    if _RAMP.search(t):
        return AmenityType.RAMP
    if _STALL.match(t) or _STALL2.search(t) or t.upper().startswith(("STALL", "BOOTH")):
        return AmenityType.OTHER  # treat as retail stall, not an amenity
    return AmenityType.OTHER


def annotate_ocr_list(items: list[TextItem]) -> list[dict]:
    return [
        {
            "label": t.label,
            "x": t.x,
            "y": t.y,
            "w": t.w,
            "h": t.h,
            "amenity": classify_ocr_text(t.label).value,
        }
        for t in items
    ]
