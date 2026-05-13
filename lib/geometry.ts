export type Point2 = { x: number; y: number };

export function dist2(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
