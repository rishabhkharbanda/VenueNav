/**
 * Dijkstra shortest path on the undirected static graph (same optimal route as
 * the API when no live edge overrides apply). No network calls.
 */
import type { GraphEdge, GraphNode, MapPayload } from "@/types/map";

type NB = { to: string; w: number; eid: string | null };

function buildUndirected(nodes: GraphNode[], edges: GraphEdge[]): Map<string, NB[]> {
  const adj = new Map<string, NB[]>();
  const add = (a: string, b: string, w: number, eid: string | null) => {
    if (w <= 0) return;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, w, eid });
    adj.get(b)!.push({ to: a, w, eid });
  };
  for (const e of edges) {
    const w = e.weight;
    const eid = e.edge_id ?? null;
    add(e.from, e.to, w, eid);
  }
  for (const n of nodes) {
    if (!adj.has(n.id)) adj.set(n.id, []);
  }
  return adj;
}

/**
 * Dijkstra; returns path, parallel edge ids (length path-1), and total cost.
 */
export function shortestPathSegment(
  nodes: GraphNode[],
  edges: GraphEdge[],
  start: string,
  end: string
): { path: string[]; edgeIds: (string | null)[]; cost: number } | null {
  if (start === end) return { path: [start], edgeIds: [], cost: 0 };
  const adj = buildUndirected(nodes, edges);
  const dist = new Map<string, number>();
  const prevE = new Map<string, { node: string; eid: string | null }>();
  for (const n of nodes) dist.set(n.id, Number.POSITIVE_INFINITY);
  if (!dist.has(start) || !dist.has(end)) return null;
  dist.set(start, 0);
  type T = { d: number; u: string };
  const pq: T[] = [{ d: 0, u: start }];
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { d, u } = pq.shift()!;
    if (d > (dist.get(u) ?? Number.POSITIVE_INFINITY)) continue;
    if (u === end) break;
    for (const { to, w, eid } of adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(to, nd);
        prevE.set(to, { node: u, eid });
        pq.push({ d: nd, u: to });
      }
    }
  }
  if ((dist.get(end) ?? Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY) return null;
  const path: string[] = [];
  const edgeIds: (string | null)[] = [];
  let c: string | null = end;
  while (c && c !== start) {
    const p = prevE.get(c);
    if (!p) return null;
    path.push(c);
    edgeIds.push(p.eid);
    c = p.node;
  }
  if (c !== start) return null;
  path.push(start);
  path.reverse();
  edgeIds.reverse();
  return { path, edgeIds, cost: dist.get(end)! };
}

/**
 * One hop or full chain, matching server /route and /route/multi (static graph).
 */
export function routeOfflineStops(
  payload: MapPayload,
  stopNodeIds: string[]
): { nodes: string[]; edgeIds: string[]; totalCost: number } | null {
  if (stopNodeIds.length < 2) return null;
  const nodes = payload.nodes;
  const edges = payload.edges;
  const allPath: string[] = [];
  const allEdgeIds: string[] = [];
  let total = 0;
  for (let i = 0; i < stopNodeIds.length - 1; i++) {
    const a = stopNodeIds[i]!;
    const b = stopNodeIds[i + 1]!;
    const seg = shortestPathSegment(nodes, edges, a, b);
    if (!seg) return null;
    total += seg.cost;
    if (!allPath.length) {
      allPath.push(...seg.path);
    } else {
      allPath.push(...seg.path.slice(1));
    }
    for (const e of seg.edgeIds) {
      if (e != null) allEdgeIds.push(e);
    }
  }
  return { nodes: allPath, edgeIds: allEdgeIds, totalCost: total };
}
