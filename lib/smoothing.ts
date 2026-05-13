import type { Point2 } from "./geometry";

/** Simple exponential moving average for low-latency jitter reduction. */
export function emaPoint(prev: Point2 | null, next: Point2, alpha = 0.35): Point2 {
  if (!prev) return next;
  return {
    x: prev.x * (1 - alpha) + next.x * alpha,
    y: prev.y * (1 - alpha) + next.y * alpha,
  };
}

/**
 * Build quadratic-smoothed polyline control points (Chaikin-like corner cutting, one pass).
 * Keeps endpoints; good cheap visual smoothing for display paths.
 */
export function smoothPolyline(points: Point2[], iterations = 1): Point2[] {
  if (points.length < 3) return points;
  let out = points;
  for (let it = 0; it < iterations; it++) {
    const next: Point2[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const p0 = out[i];
      const p1 = out[i + 1];
      next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
      next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}
