from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class GraphNodeDTO(BaseModel):
    id: str
    x: float
    y: float
    type: str
    label: str | None = None


class GraphEdgeDTO(BaseModel):
    from_: str = Field(validation_alias="from", serialization_alias="from")
    to: str
    weight: float
    edge_id: str | None = None

    model_config = {"populate_by_name": True}


class GraphEdgeLiveDTO(BaseModel):
    edge_id: str
    crowd_factor: float
    is_closed: bool
    priority: float
    updated_at: datetime


class ShopDTO(BaseModel):
    id: str
    name: str
    location_node: str
    category: str | None = None
    tags: list[str] = []
    metadata: dict[str, Any] = {}


class MapPayloadDTO(BaseModel):
    map_id: str
    map_version_id: str
    width: float | None = None
    height: float | None = None
    unit: str | None = None
    raster_url: str | None = None
    nodes: list[GraphNodeDTO]
    edges: list[GraphEdgeDTO]
    shops: list[ShopDTO]

    model_config = {"populate_by_name": True}


class MapVersionDTO(BaseModel):
    id: str
    version: int
    width: float
    height: float
    unit: str
    srid: int
    created_at: datetime


class RouteResponseDTO(BaseModel):
    map_version_id: str
    from_node: str
    to_node: str
    nodes: list[str]
    edge_ids: list[str] = []
    total_cost: float


class ProcessingJobDTO(BaseModel):
    id: UUID
    map_id: UUID
    status: str
    progress: float
    error_message: str | None
    created_at: datetime
