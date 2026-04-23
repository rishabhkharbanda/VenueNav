"""Dynamic edge overrides: Redis epoch and effective routing cost."""

from __future__ import annotations

import uuid
from typing import Any

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from venuenav.db.models import GraphEdge, GraphEdgeLive

_MIN_COST = 1e-9


def live_epoch_key(map_id: uuid.UUID) -> str:
    return f"venuenav:map:{map_id}:live_epoch"


def get_live_epoch(r: redis.Redis, map_id: uuid.UUID) -> int:
    raw = r.get(live_epoch_key(map_id))
    return int(raw) if raw is not None else 0


def bump_live_epoch(r: redis.Redis, map_id: uuid.UUID) -> int:
    return int(r.incr(live_epoch_key(map_id)))


def effective_routing_weight(base: float, live: GraphEdgeLive | None) -> float | None:
    """
    cost = max(MIN, weight * crowd_factor + priority), or None if closed.
    """
    if live is not None and live.is_closed:
        return None
    crowd = 1.0
    pr = 0.0
    if live is not None:
        crowd = float(live.crowd_factor)
        pr = float(live.priority)
    out = float(base) * crowd + pr
    if out <= 0.0:
        return _MIN_COST
    return out


def load_live_by_edge_ids(
    db: Session, edge_ids: list[uuid.UUID]
) -> dict[uuid.UUID, GraphEdgeLive]:
    if not edge_ids:
        return {}
    rows = (
        db.execute(select(GraphEdgeLive).where(GraphEdgeLive.graph_edge_id.in_(edge_ids)))
        .scalars()
        .all()
    )
    return {x.graph_edge_id: x for x in rows}


def list_live_for_version(db: Session, map_version_id: uuid.UUID) -> list[GraphEdgeLive]:
    rows = (
        db.execute(
            select(GraphEdgeLive)
            .join(GraphEdge, GraphEdge.id == GraphEdgeLive.graph_edge_id)
            .where(GraphEdge.map_version_id == map_version_id)
        )
        .scalars()
        .all()
    )
    return list(rows)


def live_row_to_dict(row: GraphEdgeLive) -> dict[str, Any]:
    return {
        "edge_id": str(row.graph_edge_id),
        "crowd_factor": row.crowd_factor,
        "is_closed": row.is_closed,
        "priority": row.priority,
        "updated_at": row.updated_at,
    }
