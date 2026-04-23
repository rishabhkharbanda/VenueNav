import { apiFetch } from "@/api/client";
import type { MapPayload, MapVersion, RouteResponse } from "@/types/mapGraph";

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
