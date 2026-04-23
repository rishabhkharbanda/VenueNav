import type { GraphNode, GraphEdge, MapPayload, MapShop } from "@/types/mapGraph";
import { buildPayload, euclidean, nearestNodeId, recomputeAllEdgeWeights, getFootprint } from "@/lib/graphModel";
import { buildAdj } from "./rules/connectivity";

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

/** Add an undirected edge if missing, with computed weight. */
function addEdgeToPayload(g: MapPayload, from: string, to: string): MapPayload {
  if (from === to) return g;
  if (g.edges.some((e) => edgeKey(e.from, e.to) === edgeKey(from, to))) return g;
  const u = g.nodes.find((n) => n.id === from);
  const v = g.nodes.find((n) => n.id === to);
  if (!u || !v) return g;
  const edges: GraphEdge[] = [...g.edges, { from, to, weight: euclidean(u, v) }];
  return buildPayload(g, { edges: recomputeAllEdgeWeights(g.nodes, edges) });
}

/**
 * For each component pair, add one edge between the two closest nodes (greedy, repeat until one component).
 */
export function connectNearestAcrossComponents(g: MapPayload): MapPayload {
  if (g.nodes.length < 2) return g;
  let out = g;
  const idSet = new Set(out.nodes.map((n) => n.id));
  const getAdj = () => buildAdj(out.nodes, out.edges, idSet);
  let iter = 0;
  const maxIter = 500;
  while (iter < maxIter) {
    iter++;
    const adj = getAdj();
    const seen = new Set<string>();
    const comps: string[][] = [];
    for (const n of out.nodes) {
      if (seen.has(n.id)) continue;
      const comp: string[] = [];
      const st = [n.id];
      seen.add(n.id);
      while (st.length) {
        const u = st.pop()!;
        comp.push(u);
        for (const v of adj.get(u) ?? []) {
          if (!seen.has(v)) {
            seen.add(v);
            st.push(v);
          }
        }
      }
      comps.push(comp);
    }
    if (comps.length < 2) break;
    let best: { a: string; b: string; d2: number } | null = null;
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        for (const a of comps[i]!) {
          for (const b of comps[j]!) {
            const na = out.nodes.find((x) => x.id === a);
            const nb = out.nodes.find((x) => x.id === b);
            if (!na || !nb) continue;
            const d2 = (na.x - nb.x) ** 2 + (na.y - nb.y) ** 2;
            if (!best || d2 < best.d2) best = { a, b, d2 };
          }
        }
      }
    }
    if (!best) break;
    out = addEdgeToPayload(out, best.a, best.b);
  }
  return out;
}

export function attachAllShopsToNearestNode(g: MapPayload): MapPayload {
  if (!g.nodes.length) return g;
  const shops: MapShop[] = g.shops.map((s) => {
    const poly = getFootprint(s);
    if (poly.length < 1) {
      const nn = nearestNodeId(0, 0, g.nodes) ?? g.nodes[0]!.id;
      return { ...s, location_node: nn };
    }
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p.x;
      cy += p.y;
    }
    cx /= poly.length;
    cy /= poly.length;
    const nn = nearestNodeId(cx, cy, g.nodes) ?? g.nodes[0]!.id;
    return { ...s, location_node: nn };
  });
  return buildPayload(g, { shops });
}

export function removeOrphanNodes(g: MapPayload): MapPayload {
  const idSet = new Set(g.nodes.map((n) => n.id));
  const degree = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) {
    if (e.from === e.to) continue;
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const keep = new Set(g.nodes.filter((n) => (degree.get(n.id) ?? 0) > 0).map((n) => n.id));
  if (keep.size === g.nodes.length) return g;
  if (keep.size === 0) return g;
  const nodes = g.nodes.filter((n) => keep.has(n.id));
  const edges = g.edges.filter((e) => keep.has(e.from) && keep.has(e.to));
  const shops = g.shops
    .filter((s) => s.location_node && keep.has(s.location_node))
    .map((s) => s);
  return buildPayload(g, { nodes, edges, shops });
}

/**
 * Merge nodes that are within `minDist` (union by proximity). Canonical id is lexicographically smallest in component; position is centroid.
 */
export function mergeOverlappingNodes(g: MapPayload, minDist: number): MapPayload {
  if (g.nodes.length < 2) return g;
  const r = minDist;
  const ids = g.nodes.map((n) => n.id);
  const u = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    const p = u.get(x)!;
    if (p === x) return x;
    const r0 = find(p);
    u.set(x, r0);
    return r0;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const keep = ra < rb ? ra : rb;
    const drop = ra < rb ? rb : ra;
    u.set(drop, keep);
  };
  for (let i = 0; i < g.nodes.length; i++) {
    for (let j = i + 1; j < g.nodes.length; j++) {
      const a = g.nodes[i]!;
      const b = g.nodes[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < r) union(a.id, b.id);
    }
  }
  const byRoot = new Map<string, GraphNode[]>();
  for (const n of g.nodes) {
    const root = find(n.id);
    const list = byRoot.get(root) ?? [];
    list.push(n);
    byRoot.set(root, list);
  }
  const newNodes: GraphNode[] = [];
  const oldToNew = new Map<string, string>();
  for (const list of byRoot.values()) {
    list.sort((x, y) => x.id.localeCompare(y.id));
    const repId = list[0]!.id;
    const sx = list.reduce((a, n) => a + n.x, 0) / list.length;
    const sy = list.reduce((a, n) => a + n.y, 0) / list.length;
    const merged: GraphNode = { ...list[0]!, id: repId, x: sx, y: sy };
    newNodes.push(merged);
    for (const n of list) oldToNew.set(n.id, repId);
  }
  const nodeIdSet = new Set(newNodes.map((n) => n.id));
  const seen = new Set<string>();
  const rawEdges: GraphEdge[] = [];
  const byId = new Map(newNodes.map((n) => [n.id, n]));
  for (const e of g.edges) {
    const a = oldToNew.get(e.from) ?? e.from;
    const b = oldToNew.get(e.to) ?? e.to;
    if (a === b) continue;
    if (!nodeIdSet.has(a) || !nodeIdSet.has(b)) continue;
    const k = edgeKey(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    const na = byId.get(a);
    const nb = byId.get(b);
    if (!na || !nb) continue;
    rawEdges.push({ from: a, to: b, weight: euclidean(na, nb) });
  }
  const edges = recomputeAllEdgeWeights(newNodes, rawEdges);
  const shops: MapShop[] = g.shops.map((s) => ({
    ...s,
    location_node: oldToNew.get(s.location_node) ?? s.location_node,
  }));
  return buildPayload(g, { nodes: newNodes, edges, shops });
}
