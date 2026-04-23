from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from venuenav.common.dtos import ShopDTO
from venuenav.db.models import GraphNode, Shop


def search_shops(
    db: Session, map_version_id: UUID, q: str, limit: int = 50
) -> list[ShopDTO]:
    if not (q and q.strip()):
        return []
    qvec = func.plainto_tsquery("simple", q)
    stmt = (
        select(Shop, GraphNode.external_id)
        .join(GraphNode, GraphNode.id == Shop.location_node_id)
        .where(Shop.map_version_id == map_version_id)
        .where(Shop.search_vector.op("@@")(qvec))
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    if not rows and q:
        stmt2 = (
            select(Shop, GraphNode.external_id)
            .join(GraphNode, GraphNode.id == Shop.location_node_id)
            .where(Shop.map_version_id == map_version_id)
            .where(Shop.name.ilike(f"%{q}%"))
            .limit(limit)
        )
        rows = db.execute(stmt2).all()
    out: list[ShopDTO] = []
    for shop, ext in rows:
        tags = [t.tag for t in (shop.tags or [])] if hasattr(shop, "tags") and shop.tags else []
        if not tags:
            tq = db.execute(
                text("SELECT tag FROM shop_tag WHERE shop_id = :sid"), {"sid": str(shop.id)}
            ).all()
            tags = [r[0] for r in tq]
        out.append(
            ShopDTO(
                id=shop.external_id or str(shop.id),
                name=shop.name,
                location_node=ext,
                category=shop.category,
                tags=tags,
                metadata=dict(shop.extra or {}),
            )
        )
    return out
