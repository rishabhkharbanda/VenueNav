import type { MapPayload, MapShop } from "@/types/mapGraph";
import type { ValidationIssue } from "@/validation/types";
import { getFootprint } from "@/lib/graphModel";

function centroid(shop: MapShop) {
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

/**
 * Fills in missing `focus` using graph geometry so “zoom to issue” can center the view.
 */
export function enrichIssueFoci(graph: MapPayload, issues: ValidationIssue[]): ValidationIssue[] {
  const nodeBy = new Map(graph.nodes.map((n) => [n.id, n]));
  return issues.map((iss) => {
    if (iss.focus) return iss;
    const ids = iss.relatedIds;
    if (!ids?.length) return iss;
    for (const id of ids) {
      const n = nodeBy.get(id);
      if (n) {
        return { ...iss, focus: { x: n.x, y: n.y } };
      }
      const shop = graph.shops.find((s) => s.id === id);
      if (shop) {
        const c = centroid(shop);
        if (c) return { ...iss, focus: c };
      }
    }
    if (ids.length >= 2) {
      const a = nodeBy.get(ids[0]!);
      const b = nodeBy.get(ids[1]!);
      if (a && b) {
        return { ...iss, focus: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      }
    }
    return iss;
  });
}
