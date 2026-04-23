from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from geoalchemy2 import Geometry
from sqlalchemy.orm import Mapped, mapped_column, relationship

from venuenav.db.base import Base


class Shop(Base):
    __tablename__ = "shop"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("map_version.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("graph_node.id", ondelete="RESTRICT"), nullable=False
    )
    footprint: Mapped[object | None] = mapped_column(Geometry(geometry_type="POLYGON", srid=0), nullable=True)
    # Column name "metadata" in DB; attribute cannot be "metadata" (SQLAlchemy reserved).
    extra: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    search_vector: Mapped[object | None] = mapped_column(TSVECTOR, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    map_version: Mapped["MapVersion"] = relationship("MapVersion", back_populates="shops")
    location_node: Mapped["GraphNode"] = relationship("GraphNode")
    tags: Mapped[list["ShopTag"]] = relationship("ShopTag", back_populates="shop", cascade="all, delete-orphan")


class ShopTag(Base):
    __tablename__ = "shop_tag"

    shop_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("shop.id", ondelete="CASCADE"), primary_key=True)
    tag: Mapped[str] = mapped_column(Text, primary_key=True)

    shop: Mapped["Shop"] = relationship("Shop", back_populates="tags")
