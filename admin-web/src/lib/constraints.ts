import type { GraphNode } from "@/types/mapGraph";
import { DEFAULT_GRID_SIZE } from "@/validation/constants";

export function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  const g = gridSize > 0 ? gridSize : DEFAULT_GRID_SIZE;
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}

export function minDistToOtherNodes(
  x: number,
  y: number,
  excludeId: string | null,
  nodes: GraphNode[]
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const n of nodes) {
    if (excludeId && n.id === excludeId) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < best) best = d;
  }
  return best;
}

export function canPlaceNodeAt(
  x: number,
  y: number,
  excludeId: string | null,
  nodes: GraphNode[],
  minSep: number
): boolean {
  return minDistToOtherNodes(x, y, excludeId, nodes) >= minSep;
}
