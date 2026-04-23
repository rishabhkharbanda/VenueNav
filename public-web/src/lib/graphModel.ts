import type { GraphNode, MapShop } from "@/types/map";

const META_KEY = "venuenav:footprint";

export function getFootprint(shop: MapShop): { x: number; y: number }[] {
  const raw = shop.metadata?.[META_KEY] as
    | { type: "polygon"; points: { x: number; y: number }[] }
    | undefined;
  if (raw?.type === "polygon" && Array.isArray(raw.points)) return raw.points;
  return [];
}

export function shopCentroid(shop: MapShop): { x: number; y: number } | null {
  const poly = getFootprint(shop);
  if (poly.length < 1) return null;
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function nearestNodeId(x: number, y: number, nodes: GraphNode[]): string | null {
  if (nodes.length === 0) return null;
  let best = nodes[0]!;
  let d = Math.hypot(x - best.x, y - best.y);
  for (const n of nodes) {
    const nd = Math.hypot(n.x - x, n.y - y);
    if (nd < d) {
      d = nd;
      best = n;
    }
  }
  return best.id;
}

export function findEntranceNode(nodes: GraphNode[]): GraphNode | null {
  const byType = nodes.filter((n) => n.type === "entrance");
  if (byType.length) return byType[0]!;
  const labeled = nodes.filter((n) => n.label && /entrance|entry|main gate/i.test(n.label));
  return labeled[0] ?? null;
}
