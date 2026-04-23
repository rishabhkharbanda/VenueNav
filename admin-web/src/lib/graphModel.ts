import type { GraphEdge, GraphNode, MapPayload, MapShop } from "@/types/mapGraph";

const META_KEY = "venuenav:footprint";

export function euclidean(a: GraphNode, b: GraphNode): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function makeEdgeId(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export function recomputeAllEdgeWeights(
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return edges.map((e) => {
    const u = byId.get(e.from);
    const v = byId.get(e.to);
    const w = u && v ? euclidean(u, v) : e.weight;
    return { ...e, weight: w };
  });
}

export function hasDuplicateEdge(edges: GraphEdge[], from: string, to: string): boolean {
  const a = new Set(
    edges.map((e) => [e.from, e.to].sort().join("::"))
  );
  return a.has([from, to].sort().join("::"));
}

export function getFootprint(shop: MapShop): { x: number; y: number }[] {
  const raw = shop.metadata?.[META_KEY] as
    | { type: "polygon"; points: { x: number; y: number }[] }
    | undefined;
  if (raw?.type === "polygon" && Array.isArray(raw.points)) return raw.points;
  return [];
}

export function setFootprint(shop: MapShop, points: { x: number; y: number }[]): MapShop {
  return {
    ...shop,
    metadata: {
      ...shop.metadata,
      [META_KEY]: { type: "polygon" as const, points },
    },
  };
}

export function nearestNodeId(
  x: number,
  y: number,
  nodes: GraphNode[]
): string | null {
  if (nodes.length === 0) return null;
  let best = nodes[0];
  let d = Math.hypot(x - best.x, y - best.y);
  for (const n of nodes) {
    const nd = Math.hypot(x - n.x, y - n.y);
    if (nd < d) {
      d = nd;
      best = n;
    }
  }
  return best.id;
}

export function buildPayload(
  base: MapPayload,
  updates: Partial<
    Pick<MapPayload, "nodes" | "edges" | "shops" | "width" | "height" | "unit" | "raster_url">
  >
): MapPayload {
  const nodes = updates.nodes ?? base.nodes;
  const edges = recomputeAllEdgeWeights(nodes, updates.edges ?? base.edges);
  return {
    ...base,
    ...updates,
    nodes,
    edges,
  };
}
