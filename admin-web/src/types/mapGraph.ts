/** Aligned with backend MapPayload DTO. */

export type NodeType =
  | "intersection"
  | "entrance"
  | "exit"
  | "shop_entry"
  | "generic";

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  label?: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ShopMetaFootprint {
  type: "polygon";
  points: { x: number; y: number }[];
}

export interface MapShop {
  id: string;
  name: string;
  location_node: string;
  category?: string | null;
  tags: string[];
  /** Backend stores in JSONB; footprint stored here for round-trip. */
  metadata: Record<string, unknown>;
}

export interface MapPayload {
  map_id: string;
  map_version_id: string;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  raster_url?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  shops: MapShop[];
}

export interface MapVersion {
  id: string;
  version: number;
  width: number;
  height: number;
  unit: string;
  srid: number;
  created_at: string;
}

export interface RouteResponse {
  map_version_id: string;
  from_node: string;
  to_node: string;
  nodes: string[];
  edge_ids: string[];
  total_cost: number;
}
