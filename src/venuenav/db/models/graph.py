from __future__ import annotations

import uuid

from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Double, ForeignKey, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from venuenav.db.base import Base


class GraphNode(Base):
    __tablename__ = "graph_node"
    __table_args__ = (UniqueConstraint("map_version_id", "external_id", name="uq_node_version_ext"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("map_version.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    node_type: Mapped[str] = mapped_column(Text, nullable=False, default="generic")
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    geom: Mapped[object] = mapped_column(Geometry(geometry_type="POINT", srid=0), nullable=False)

    map_version: Mapped["MapVersion"] = relationship("MapVersion", back_populates="graph_nodes")
    edges_from: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge", back_populates="from_node", foreign_keys="GraphEdge.from_node_id"
    )
    edges_to: Mapped[list["GraphEdge"]] = relationship(
        "GraphEdge", back_populates="to_node", foreign_keys="GraphEdge.to_node_id"
    )


class GraphEdge(Base):
    __tablename__ = "graph_edge"
    __table_args__ = (
        UniqueConstraint("map_version_id", "from_node_id", "to_node_id", name="uq_edge_version_from_to"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("map_version.id", ondelete="CASCADE"), nullable=False
    )
    from_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("graph_node.id", ondelete="CASCADE"), nullable=False
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("graph_node.id", ondelete="CASCADE"), nullable=False
    )
    weight: Mapped[float] = mapped_column(Double, nullable=False)
    path: Mapped[object | None] = mapped_column(Geometry(geometry_type="LINESTRING", srid=0), nullable=True)

    map_version: Mapped["MapVersion"] = relationship("MapVersion", back_populates="graph_edges")
    from_node: Mapped["GraphNode"] = relationship("GraphNode", foreign_keys=[from_node_id], back_populates="edges_from")
    to_node: Mapped["GraphNode"] = relationship("GraphNode", foreign_keys=[to_node_id], back_populates="edges_to")
    live: Mapped["GraphEdgeLive | None"] = relationship(
        "GraphEdgeLive", back_populates="edge", uselist=False, cascade="all, delete-orphan"
    )


class GraphEdgeLive(Base):
    __tablename__ = "graph_edge_live"

    graph_edge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("graph_edge.id", ondelete="CASCADE"), primary_key=True
    )
    crowd_factor: Mapped[float] = mapped_column(Double, nullable=False, default=1.0)
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[float] = mapped_column(Double, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    edge: Mapped["GraphEdge"] = relationship("GraphEdge", back_populates="live")
