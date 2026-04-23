import type { MapShop } from "@/types/map";
import { getFootprint, shopCentroid } from "@/lib/graphModel";

function pointInPolygon(
  x: number,
  y: number,
  poly: { x: number; y: number }[]
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pickShopAt(
  x: number,
  y: number,
  shops: MapShop[]
): string | null {
  let best: { id: string; d2: number } | null = null;
  for (const s of shops) {
    const poly = getFootprint(s);
    if (poly.length >= 3 && pointInPolygon(x, y, poly)) {
      return s.id;
    }
    const c = shopCentroid(s);
    if (c) {
      const d2 = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d2 < 55 * 55 && (!best || d2 < best.d2)) best = { id: s.id, d2 };
    }
  }
  return best?.id ?? null;
}
