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
  edge_id?: string;
}

export interface MapShop {
  id: string;
  name: string;
  location_node: string;
  category?: string | null;
  tags: string[];
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

export interface PublicMapMeta {
  map_id: string;
  map_version_id: string;
  raster_url: string | null;
  name: string;
}

export interface SearchItem {
  id: string;
  name: string;
  location_node: string;
  category?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  items: SearchItem[];
}

export interface RouteResponse {
  map_version_id: string;
  from_node: string;
  to_node: string;
  nodes: string[];
  edge_ids: string[];
  total_cost: number;
}

export interface MultiRouteResponse {
  map_version_id: string;
  from_node: string;
  to_node: string;
  nodes: string[];
  edge_ids: string[];
  total_cost: number;
  segment_routes: Record<string, unknown>[];
}

export type LiveEdgeOverride = {
  edge_id: string;
  crowd_factor: number;
  is_closed: boolean;
  priority: number;
  updated_at: string;
};

export type PublicLiveEdgesResponse = {
  map_id: string;
  map_version_id: string;
  live_epoch: number;
  edges: LiveEdgeOverride[];
};
