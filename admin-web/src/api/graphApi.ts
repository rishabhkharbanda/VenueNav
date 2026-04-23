import { apiFetch } from "@/api/client";
import type { MapPayload, MapVersion, RouteResponse } from "@/types/mapGraph";

export type MapSummary = {
  id: string;
  name: string;
  status: string;
  published_version: number | null;
  updated_at: string;
};

export async function getMapSummary(orgId: string, mapId: string): Promise<MapSummary> {
  const r = await apiFetch(`/v1/organizations/${orgId}/maps/${mapId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getGraph(
  orgId: string,
  mapId: string,
  state: "draft" | "published" = "draft"
): Promise<MapPayload> {
  const r = await apiFetch(
    `/v1/organizations/${orgId}/maps/${mapId}/graph?state=${state}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type SuggestedImportAnnotations = {
  graph_mode?: "skeleton" | "grid" | string;
  node_zone_id?: Record<string, string>;
  node_confidence?: Record<string, number>;
  edges_detail?: {
    from: string;
    to: string;
    path_length_px?: number;
    mean_corridor_radius_px?: number;
    weight: number;
    confidence: number;
    /** Unit direction from `from` → `to` in map pixel space (for turn-by-turn). */
    dx: number;
    dy: number;
    path_class?: "main_corridor" | "secondary_path" | "connectivity_bridge" | string;
  }[];
  connectivity_bridges?: {
    from: string;
    to: string;
    path_length_px?: number;
    mean_corridor_radius_px?: number;
    weight: number;
    confidence: number;
    dx: number;
    dy: number;
    path_class?: string;
  }[];
};

export type OcrSemanticRow = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  amenity: string;
};

export type ImportArtifact = {
  pipeline: string;
  job?: string;
  width_px: number;
  height_px: number;
  dpi: number;
  grid: { spacing_px: number; confidence: number; spacing_x?: number; spacing_y?: number } | null;
  ocr: { label: string; x: number; y: number; w: number; h: number }[];
  ocr_semantic?: OcrSemanticRow[];
  zones: { id: string; label: string; bbox: number[]; polygon?: [number, number][] }[];
  suggested: MapPayload;
  /** Skeleton confidence, zone ids, etc. (v2 pipeline) */
  suggested_annotations?: SuggestedImportAnnotations;
  raster?: { width_px: number; height_px: number };
};

export async function getImportArtifact(
  orgId: string,
  mapId: string
): Promise<{ artifact: ImportArtifact | null; raster_url: string | null }> {
  const r = await apiFetch(
    `/v1/organizations/${orgId}/maps/${mapId}/import-artifact`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function presignPdfUpload(
  orgId: string,
  mapId: string
): Promise<{ upload_url: string; asset_id: string; headers: { "Content-Type": string } }> {
  const r = await apiFetch(`/v1/organizations/${orgId}/maps/${mapId}/upload`, {
    method: "POST",
    json: { content_type: "application/pdf" },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function startMapProcess(
  orgId: string,
  mapId: string,
  assetId: string
): Promise<{ id: string; status: string }> {
  const r = await apiFetch(`/v1/organizations/${orgId}/maps/${mapId}/process`, {
    method: "POST",
    json: { asset_id: assetId, options: {} },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getMapJob(
  orgId: string,
  mapId: string,
  jobId: string
): Promise<{
  id: string;
  status: string;
  progress: number;
  error_message: string | null;
  created_at: string;
}> {
  const r = await apiFetch(
    `/v1/organizations/${orgId}/maps/${mapId}/jobs/${jobId}`
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function putGraph(
  orgId: string,
  mapId: string,
  payload: MapPayload
): Promise<void> {
  const r = await apiFetch(`/v1/organizations/${orgId}/maps/${mapId}/graph`, {
    method: "PUT",
    json: payload,
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function publishMap(
  orgId: string,
  mapId: string
): Promise<MapVersion> {
  const r = await apiFetch(`/v1/organizations/${orgId}/maps/${mapId}/publish`, {
    method: "POST",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getServerRoute(
  mapId: string,
  fromNode: string,
  toNode: string,
  version?: number
): Promise<RouteResponse> {
  const q = new URLSearchParams({ from_node: fromNode, to_node: toNode });
  if (version != null) q.set("version", String(version));
  const r = await apiFetch(`/v1/public/maps/${mapId}/route?${q}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type PublicLiveEdge = {
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
  edges: PublicLiveEdge[];
};

export async function getPublicLiveEdges(mapId: string): Promise<PublicLiveEdgesResponse> {
  const r = await apiFetch(`/v1/public/maps/${mapId}/live-edges`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type EdgeLivePatch = {
  crowd_factor?: number;
  is_closed?: boolean;
  priority?: number;
};

export async function patchEdgeLive(
  orgId: string,
  mapId: string,
  edgeId: string,
  body: EdgeLivePatch
): Promise<PublicLiveEdge> {
  const r = await apiFetch(
    `/v1/organizations/${orgId}/maps/${mapId}/edges/${edgeId}/live`,
    { method: "PATCH", json: body }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
