"use client";

import { useCallback, useRef, useState } from "react";
import { HandTracker, type HandTrackerPayload } from "@/components/HandTracker";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import type { Point2 } from "@/lib/geometry";
import { dist2 } from "@/lib/geometry";

const MIN_POINT_DIST = 0.0035;

function appendIfFarEnough(stroke: Point2[], p: Point2) {
  const last = stroke[stroke.length - 1];
  if (!last || dist2(last, p) >= MIN_POINT_DIST) stroke.push(p);
}

/**
 * Orchestrates webcam tracking, gesture state, and stroke accumulation.
 * Drawing updates use refs; UI badge uses rAF-throttled React state.
 */
export default function App() {
  const strokesRef = useRef<Point2[][]>([]);
  const currentStrokeRef = useRef<Point2[]>([]);
  const wasDrawingRef = useRef(false);
  const uiRafRef = useRef<number | null>(null);
  const pendingUiRef = useRef({ tracking: false, drawing: false });

  const [ui, setUi] = useState({ tracking: false, drawing: false });
  const [error, setError] = useState<string | null>(null);

  const scheduleUi = useCallback(() => {
    if (uiRafRef.current != null) return;
    uiRafRef.current = requestAnimationFrame(() => {
      uiRafRef.current = null;
      const p = pendingUiRef.current;
      setUi((prev) =>
        prev.tracking === p.tracking && prev.drawing === p.drawing ? prev : { ...p },
      );
    });
  }, []);

  const onHandFrame = useCallback(
    ({ indexTipNorm, isDrawing, tracking }: HandTrackerPayload) => {
      pendingUiRef.current = { tracking, drawing: isDrawing };
      scheduleUi();

      const was = wasDrawingRef.current;
      wasDrawingRef.current = isDrawing;

      if (isDrawing && indexTipNorm) {
        if (!was) {
          currentStrokeRef.current = [indexTipNorm];
        } else {
          appendIfFarEnough(currentStrokeRef.current, indexTipNorm);
        }
      } else if (was && !isDrawing) {
        const cur = currentStrokeRef.current;
        if (cur.length > 1) strokesRef.current = [...strokesRef.current, cur];
        currentStrokeRef.current = [];
      }
    },
    [scheduleUi],
  );

  const onError = useCallback((m: string) => setError(m), []);

  const clear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#020617",
      }}
    >
      <HandTracker className="hand-video" onHandFrame={onHandFrame} onError={onError} />

      <DrawingCanvas strokesRef={strokesRef} currentStrokeRef={currentStrokeRef} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(2,6,23,0.45) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "auto",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-label={ui.tracking ? "Hand tracking active" : "Searching for hand"}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: ui.tracking ? "#22c55e" : "#64748b",
              boxShadow: ui.tracking ? "0 0 14px rgba(34,197,94,0.9)" : "none",
              transition: "background 120ms ease",
            }}
          />
          <span>{ui.tracking ? "Tracking" : "No hand"}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ color: ui.drawing ? "#5eead4" : "#94a3b8" }}>
            {ui.drawing ? "Drawing" : "Idle"}
          </span>
        </div>
        <p style={{ margin: 0, maxWidth: 320, opacity: 0.78 }}>
          Raise your index finger to draw. Lower it to finish a stroke. Mirror preview
          matches pointer direction.
        </p>
        <button
          type="button"
          onClick={clear}
          style={{
            alignSelf: "flex-start",
            pointerEvents: "auto",
            cursor: "pointer",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.45)",
            background: "rgba(15,23,42,0.65)",
            color: "#e2e8f0",
            padding: "6px 12px",
            fontSize: 12,
          }}
        >
          Clear canvas
        </button>
        {error ? (
          <p style={{ margin: 0, color: "#fca5a5", maxWidth: 360 }}>{error}</p>
        ) : null}
      </div>

    </div>
  );
}
