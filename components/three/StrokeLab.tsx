"use client";

import type { Point2 } from "@/lib/geometry";
import { ShapeGenerator } from "@/components/three/ShapeGenerator";

/** Demo stroke in normalized screen space (same convention as the drawing canvas). */
export const DEMO_STROKE: Point2[] = [
  { x: 0.12, y: 0.78 },
  { x: 0.22, y: 0.42 },
  { x: 0.36, y: 0.62 },
  { x: 0.5, y: 0.28 },
  { x: 0.64, y: 0.62 },
  { x: 0.78, y: 0.42 },
  { x: 0.88, y: 0.78 },
];

export default function StrokeLab() {
  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(148,163,184,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Stroke → 3D</h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.82, maxWidth: 560 }}>
          Preview of the extruded ribbon mesh. Import <code>createStrokeExtrudeGeometry</code> from{" "}
          <code>@/lib/strokeToMesh</code> to turn any <code>Point2[]</code> into geometry without this page.
        </p>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ShapeGenerator points={DEMO_STROKE} />
      </div>
    </main>
  );
}
