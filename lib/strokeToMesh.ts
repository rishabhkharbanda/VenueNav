import * as THREE from "three";
import type { Point2 } from "@/lib/geometry";
import { smoothPolyline } from "@/lib/smoothing";

export type StrokeToMeshOptions = {
  /** Approximate half-size of the stroke footprint after normalization. */
  targetSize?: number;
  /** Half thickness of the ribbon in shape space (after normalization). */
  ribbonHalfWidth?: number;
  /** Extrusion depth (Z in shape local space before mesh centering). */
  depth?: number;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
  curveSegments?: number;
  /** Chaikin smoothing passes on screen-space polyline before normalization. */
  smoothPasses?: number;
};

/**
 * Converts a 2D polyline into a closed ribbon outline suitable for extrusion.
 */
function ribbonOutline(pts: THREE.Vector2[], halfWidth: number): THREE.Vector2[] {
  const n = pts.length;
  if (n < 2) return [];
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const tangent = new THREE.Vector2().subVectors(next, prev);
    if (tangent.lengthSq() < 1e-12) tangent.set(1, 0);
    tangent.normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(halfWidth);
    left.push(new THREE.Vector2().addVectors(pts[i], normal));
    right.push(new THREE.Vector2().subVectors(pts[i], normal));
  }

  const outline: THREE.Vector2[] = [...left];
  for (let i = n - 1; i >= 0; i--) outline.push(right[i]);
  return outline;
}

function ensureMinPoints(stroke: Point2[]): Point2[] {
  if (stroke.length >= 3) return stroke;
  if (stroke.length === 2) {
    const a = stroke[0];
    const b = stroke[1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return [a, mid, b];
  }
  if (stroke.length === 1) {
    const p = stroke[0];
    const e = 0.04;
    return [
      { x: p.x - e, y: p.y },
      { x: p.x, y: p.y - e },
      { x: p.x + e, y: p.y },
    ];
  }
  return [
    { x: 0.4, y: 0.5 },
    { x: 0.5, y: 0.45 },
    { x: 0.6, y: 0.5 },
  ];
}

function resampleMinDistance(pts: THREE.Vector2[], minD: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.distanceTo(p) >= minD) out.push(p.clone());
  }
  return out;
}

/**
 * Normalize stroke to a centered, math-Y-up 2D footprint and scale to target size.
 */
function normalizeAndCenter(points: Point2[], targetSize: number): THREE.Vector2[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = Math.max(maxX - minX, 1e-5);
  const h = Math.max(maxY - minY, 1e-5);
  const s = targetSize / Math.max(w, h);

  return points.map(
    (p) => new THREE.Vector2((p.x - cx) * s, -(p.y - cy) * s), // flip Y → up
  );
}

/**
 * Shape processing + ribbon extrusion with soft bevels.
 * Returns centered `ExtrudeGeometry` ready to assign to a `THREE.Mesh`.
 */
export function createStrokeExtrudeGeometry(
  stroke: Point2[],
  opts: StrokeToMeshOptions = {},
): THREE.ExtrudeGeometry {
  const targetSize = opts.targetSize ?? 1.65;
  const ribbonHalfWidth = opts.ribbonHalfWidth ?? 0.09;
  const depth = opts.depth ?? 0.38;
  const bevelThickness = opts.bevelThickness ?? 0.055;
  const bevelSize = opts.bevelSize ?? 0.045;
  const bevelSegments = opts.bevelSegments ?? 4;
  const curveSegments = opts.curveSegments ?? 18;
  const smoothPasses = opts.smoothPasses ?? 1;

  const safe = ensureMinPoints(stroke);
  const asScreen: Point2[] = safe.map((p) => ({ x: p.x, y: p.y }));
  const smoothedScreen = smoothPolyline(asScreen, smoothPasses);
  const normalized = normalizeAndCenter(smoothedScreen, targetSize);
  const resampled = resampleMinDistance(normalized, 0.02);
  const outline = ribbonOutline(resampled, ribbonHalfWidth);

  const shape = new THREE.Shape(outline);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth,
    curveSegments,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelOffset: 0,
    bevelSegments,
  });

  geometry.computeVertexNormals();
  geometry.center();
  return geometry;
}
