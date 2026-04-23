from __future__ import annotations

import uuid

from sqlalchemy import Double, ForeignKey, Text, Uuid, UniqueConstraint
from geoalchemy2 import Geometry
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
