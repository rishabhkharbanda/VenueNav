from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, Uuid, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from venuenav.db.base import Base


class VenueMap(Base):
    __tablename__ = "map"
    __table_args__ = (UniqueConstraint("event_id", "slug", name="uq_map_event_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("event.id", ondelete="CASCADE"), nullable=False)
    venue_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("venue.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    draft_map_version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("map_version.id", ondelete="SET NULL"), nullable=True
    )
    published_map_version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("map_version.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    event: Mapped["Event"] = relationship("Event", back_populates="maps")
    venue: Mapped["Venue"] = relationship("Venue", back_populates="maps")
    versions: Mapped[list["MapVersion"]] = relationship("MapVersion", back_populates="map", foreign_keys="MapVersion.map_id")
    assets: Mapped[list["MapAsset"]] = relationship("MapAsset", back_populates="map_obj")


class MapAsset(Base):
    __tablename__ = "map_asset"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("map.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    byte_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    map_obj: Mapped["VenueMap"] = relationship("VenueMap", back_populates="assets")
