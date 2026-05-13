import * as THREE from "three";
import type { ExtrudeGeometry } from "three";
import type { Point2 } from "@/lib/geometry";
import { dist2 } from "@/lib/geometry";
import { createStrokeExtrudeGeometry } from "@/lib/strokeToMesh";
import type { ThemeId } from "@/lib/themePalettes";
import { randomAccent } from "@/lib/themePalettes";

export type StrokeKind = "heart" | "star" | "scribble";

const EXTRUDE = {
  depth: 0.38,
  curveSegments: 18,
  bevelThickness: 0.055,
  bevelSize: 0.045,
  bevelSegments: 4,
} as const;

const HEART_COLORS = ["#ef4444", "#dc2626", "#f87171", "#b91c1c", "#f43f5e", "#fb7185", "#fecdd3"];
const STAR_COLORS = ["#fde047", "#facc15", "#fbbf24", "#f59e0b", "#fcd34d", "#eab308"];

function bbox(stroke: Point2[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of stroke) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-4);
  const h = Math.max(maxY - minY, 1e-4);
  return { minX, maxX, minY, maxY, w, h, span: Math.max(w, h) };
}

function pathLength(stroke: Point2[]) {
  let len = 0;
  for (let i = 1; i < stroke.length; i++) len += dist2(stroke[i - 1], stroke[i]);
  return len;
}

/**
 * Lightweight sketch classifier — tuned for “tall closed loop ≈ heart” and “spiky closed ≈ star”.
 */
export function inferStrokeKind(stroke: Point2[]): StrokeKind {
  const n = stroke.length;
  if (n < 8) return "scribble";
  const { w, h, span } = bbox(stroke);
  const diag = Math.hypot(w, h) || 1e-4;
  const gap = dist2(stroke[0], stroke[n - 1]);
  const closed = gap < 0.095 * diag || gap < 0.055;
  if (!closed) return "scribble";

  const len = pathLength(stroke);
  const ratio = len / diag;
  const ar = h / (w + 1e-5);

  if (ar > 0.72 && ratio > 1.75 && ratio < 3.6) {
    return "heart";
  }
  if (ar > 0.62 && ar < 1.42 && n >= 14 && ratio > 2.75) {
    return "star";
  }
  return "scribble";
}

function extrudeShape(shape: THREE.Shape): ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: EXTRUDE.depth,
    curveSegments: EXTRUDE.curveSegments,
    bevelEnabled: true,
    bevelThickness: EXTRUDE.bevelThickness,
    bevelSize: EXTRUDE.bevelSize,
    bevelOffset: 0,
    bevelSegments: EXTRUDE.bevelSegments,
  });
  geometry.computeVertexNormals();
  geometry.center();
  return geometry;
}

/** Classic 2D heart curve (math Y-up). */
function buildHeartShape(scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const seg = 48;
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const px = (x / 16) * scale;
    const py = (y / 16) * scale;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  return shape;
}

function buildStarShape(outer: number, inner: number, points: number): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = points * 2;
  for (let i = 0; i < steps; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function templateGeometry(kind: StrokeKind, stroke: Point2[]): ExtrudeGeometry {
  const { span } = bbox(stroke);
  const refSpan = 0.42;
  const sizeMul = THREE.MathUtils.clamp(span / refSpan, 0.55, 1.85);
  const base = 1.65 * sizeMul;

  if (kind === "heart") {
    return extrudeShape(buildHeartShape(base * 0.52));
  }
  if (kind === "star") {
    return extrudeShape(buildStarShape(base * 0.48, base * 0.2, 5));
  }
  return createStrokeExtrudeGeometry(stroke);
}

function dropCount(kind: StrokeKind): number {
  if (kind === "heart") return 16;
  if (kind === "star") return 14;
  return 10;
}

function pickColor(kind: StrokeKind, theme: ThemeId, i: number): string {
  if (kind === "heart") return HEART_COLORS[i % HEART_COLORS.length];
  if (kind === "star") return STAR_COLORS[i % STAR_COLORS.length];
  return randomAccent(theme);
}

export type RainDrop = { geometry: ExtrudeGeometry; color: string };

/**
 * Builds many independent meshes (clones) for a single finished stroke — one “shower” per sketch.
 */
export function buildRainDropsFromStroke(stroke: Point2[], theme: ThemeId): RainDrop[] {
  const kind = inferStrokeKind(stroke);
  const template = templateGeometry(kind, stroke);
  const count = dropCount(kind);
  const drops: RainDrop[] = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      geometry: template.clone(),
      color: pickColor(kind, theme, i),
    });
  }
  template.dispose();
  return drops;
}
