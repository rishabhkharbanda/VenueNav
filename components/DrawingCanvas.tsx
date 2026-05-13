"use client";

import { useEffect, useRef } from "react";
import type { Point2 } from "@/lib/geometry";
import { smoothPolyline } from "@/lib/smoothing";

type Props = {
  /** Completed strokes in normalized coordinates (0–1). */
  strokesRef: React.MutableRefObject<Point2[][]>;
  /** Active stroke while index is raised. */
  currentStrokeRef: React.MutableRefObject<Point2[]>;
};

function drawStroke(
  ctx: CanvasRenderingContext2D,
  pts: Point2[],
  w: number,
  h: number,
  glow: boolean,
) {
  if (pts.length < 2) return;
  const screen = pts.map((p) => ({ x: p.x * w, y: p.y * h }));
  const smoothed = smoothPolyline(screen, 1);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (glow) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 14;
    ctx.shadowBlur = 28;
    ctx.shadowColor = "rgba(0, 240, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) {
      const p = smoothed[i];
      const prev = smoothed[i - 1];
      const cx = (prev.x + p.x) / 2;
      const cy = (prev.y + p.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
    }
    ctx.lineTo(smoothed[smoothed.length - 1].x, smoothed[smoothed.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(220, 255, 255, 0.95)";
  ctx.lineWidth = 3.2;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(120, 255, 255, 0.65)";
  ctx.beginPath();
  ctx.moveTo(smoothed[0].x, smoothed[0].y);
  for (let i = 1; i < smoothed.length; i++) {
    const p = smoothed[i];
    const prev = smoothed[i - 1];
    const cx = (prev.x + p.x) / 2;
    const cy = (prev.y + p.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
  }
  ctx.lineTo(smoothed[smoothed.length - 1].x, smoothed[smoothed.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Full-bleed overlay canvas. Renders at display refresh via requestAnimationFrame
 * and reads stroke refs to avoid per-frame React renders.
 */
export function DrawingCanvas({ strokesRef, currentStrokeRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const loop = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      for (const stroke of strokesRef.current) {
        drawStroke(ctx, stroke, w, h, true);
      }
      const cur = currentStrokeRef.current;
      if (cur.length > 1) {
        drawStroke(ctx, cur, w, h, true);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [strokesRef, currentStrokeRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
