"use client";

import type { MutableRefObject } from "react";
import { useCallback, useRef } from "react";
import type { Point2 } from "@/lib/geometry";
import { dist2 } from "@/lib/geometry";
import { takeActiveStroke } from "@/lib/strokeCommit";

const MIN_POINT_DIST = 0.004;

type Props = {
  active: boolean;
  currentStrokeRef: MutableRefObject<Point2[]>;
  onStrokeComplete: (stroke: Point2[]) => void;
};

function appendPoint(stroke: Point2[], p: Point2) {
  const last = stroke[stroke.length - 1];
  if (!last || dist2(last, p) >= MIN_POINT_DIST) stroke.push(p);
}

/**
 * Full-screen pointer capture for mouse / trackpad drawing (normalized 0–1).
 */
export function MouseDrawInput({ active, currentStrokeRef, onStrokeComplete }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);

  const normPoint = useCallback((clientX: number, clientY: number): Point2 | null => {
    const el = elRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: (clientX - r.left) / r.width,
      y: (clientY - r.top) / r.height,
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={elRef}
      role="application"
      aria-label="Draw with mouse"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        cursor: "crosshair",
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawingRef.current = true;
        const p = normPoint(e.clientX, e.clientY);
        if (p) currentStrokeRef.current = [p];
      }}
      onPointerMove={(e) => {
        if (!drawingRef.current) return;
        const p = normPoint(e.clientX, e.clientY);
        if (p) appendPoint(currentStrokeRef.current, p);
      }}
      onPointerUp={(e) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const stroke = takeActiveStroke(currentStrokeRef);
        if (stroke) onStrokeComplete(stroke);
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
        currentStrokeRef.current = [];
      }}
    />
  );
}
