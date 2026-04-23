from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Double, ForeignKey, Integer, String, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from venuenav.db.base import Base


class MapVersion(Base):
    __tablename__ = "map_version"
    __table_args__ = (UniqueConstraint("map_id", "version", name="uq_map_version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("map.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[float] = mapped_column(Double, nullable=False)
    height: Mapped[float] = mapped_column(Double, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # pixel | meter
    srid: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    map: Mapped["VenueMap"] = relationship("VenueMap", back_populates="versions", foreign_keys=[map_id])
    graph_nodes: Mapped[list["GraphNode"]] = relationship("GraphNode", back_populates="map_version")
    graph_edges: Mapped[list["GraphEdge"]] = relationship("GraphEdge", back_populates="map_version")
    shops: Mapped[list["Shop"]] = relationship("Shop", back_populates="map_version")
