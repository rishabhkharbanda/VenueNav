import { apiFetch } from "@/api/client";
import type {
  MapPayload,
  PublicMapMeta,
  PublicLiveEdgesResponse,
  SearchResponse,
  RouteResponse,
  MultiRouteResponse,
} from "@/types/map";

export async function getPublicMapMeta(eventSlug: string, mapSlug: string): Promise<PublicMapMeta> {
  const r = await apiFetch(`/v1/public/events/${encodeURIComponent(eventSlug)}/maps/${encodeURIComponent(mapSlug)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getPublicPayload(
  mapId: string,
  version?: number
): Promise<MapPayload> {
  const q = new URLSearchParams();
  if (version != null) q.set("version", String(version));
  const r = await apiFetch(
    `/v1/public/maps/${mapId}/payload${q.toString() ? `?${q}` : ""}`,
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<MapPayload>;
}

export async function publicSearch(
  mapId: string,
  query: string,
  version?: number
): Promise<SearchResponse> {
  if (!query.trim()) return { items: [] };
  const q = new URLSearchParams({ q: query.trim() });
  if (version != null) q.set("version", String(version));
  const r = await apiFetch(`/v1/public/maps/${mapId}/search?${q}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getPublicRoute(
  mapId: string,
  fromNode: string,
  toNode: string,
  version?: number
): Promise<RouteResponse> {
  const q = new URLSearchParams({ from_node: fromNode, to_node: toNode });
  if (version != null) q.set("version", String(version));
  const r = await apiFetch(`/v1/public/maps/${mapId}/route?${q}`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Route not found");
  }
  return r.json();
}

export async function postMultiRoute(
  mapId: string,
  stopNodeIds: string[],
  optimize = false
): Promise<MultiRouteResponse> {
  const r = await apiFetch(`/v1/public/maps/${mapId}/route/multi`, {
    method: "POST",
    json: { stop_node_ids: stopNodeIds, optimize },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getPublicLiveEdges(mapId: string): Promise<PublicLiveEdgesResponse> {
  const r = await apiFetch(`/v1/public/maps/${mapId}/live-edges`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
