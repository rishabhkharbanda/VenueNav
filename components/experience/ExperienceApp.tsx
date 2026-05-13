"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HandTracker, type HandTrackerPayload } from "@/components/HandTracker";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { RainCanvas } from "@/components/experience/RainCanvas";
import { MouseDrawInput } from "@/components/experience/MouseDrawInput";
import { GlassHud } from "@/components/experience/GlassHud";
import type { Point2 } from "@/lib/geometry";
import { dist2 } from "@/lib/geometry";
import { commitActiveStroke } from "@/lib/strokeCommit";
import { createStrokeExtrudeGeometry } from "@/lib/strokeToMesh";
import { playSpawnSound, resumeAudio } from "@/lib/soundKit";
import { useExperienceStore } from "@/store/experienceStore";

const MIN_POINT_DIST = 0.0035;

function appendIfFarEnough(stroke: Point2[], p: Point2) {
  const last = stroke[stroke.length - 1];
  if (!last || dist2(last, p) >= MIN_POINT_DIST) stroke.push(p);
}

/**
 * Integrated experience: rain field (R3F) + stroke input (gesture or mouse) + glass HUD.
 * New strokes → `createStrokeExtrudeGeometry` → `spawnRain` in the Zustand store.
 */
export default function ExperienceApp() {
  const inputMode = useExperienceStore((s) => s.inputMode);
  const theme = useExperienceStore((s) => s.theme);
  const setInputMode = useExperienceStore((s) => s.setInputMode);
  const setTheme = useExperienceStore((s) => s.setTheme);
  const spawnRain = useExperienceStore((s) => s.spawnRain);
  const clearRain = useExperienceStore((s) => s.clearRain);

  const strokesRef = useRef<Point2[][]>([]);
  const currentStrokeRef = useRef<Point2[]>([]);
  const wasDrawingRef = useRef(false);
  const uiRafRef = useRef<number | null>(null);
  const pendingUiRef = useRef({ tracking: false, drawing: false });

  const [gestureUi, setGestureUi] = useState({ tracking: false, drawing: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentStrokeRef.current = [];
    wasDrawingRef.current = false;
  }, [inputMode]);

  const pushStrokeIntoRain = useCallback(
    (stroke: Point2[]) => {
      resumeAudio();
      const geometry = createStrokeExtrudeGeometry(stroke);
      spawnRain(geometry);
      playSpawnSound();
    },
    [spawnRain],
  );

  const scheduleUi = useCallback(() => {
    if (uiRafRef.current != null) return;
    uiRafRef.current = requestAnimationFrame(() => {
      uiRafRef.current = null;
      const p = pendingUiRef.current;
      setGestureUi((prev) =>
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
        const stroke = commitActiveStroke(strokesRef, currentStrokeRef);
        if (stroke) pushStrokeIntoRain(stroke);
      }
    },
    [scheduleUi, pushStrokeIntoRain],
  );

  const onError = useCallback((m: string) => setError(m), []);

  const clearScene = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    wasDrawingRef.current = false;
    clearRain();
  }, [clearRain]);

  return (
    <div
      data-theme={theme}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#020617",
      }}
    >
      <RainCanvas />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
        }}
      >
        {inputMode === "gesture" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.26,
              pointerEvents: "none",
            }}
          >
            <HandTracker className="hand-video" onHandFrame={onHandFrame} onError={onError} />
          </div>
        ) : null}

        <DrawingCanvas strokesRef={strokesRef} currentStrokeRef={currentStrokeRef} />

        <MouseDrawInput
          active={inputMode === "mouse"}
          strokesRef={strokesRef}
          currentStrokeRef={currentStrokeRef}
          onStrokeComplete={pushStrokeIntoRain}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(2,6,23,0.55) 100%)",
          }}
        />
      </div>

      <GlassHud
        inputMode={inputMode}
        theme={theme}
        onInputMode={setInputMode}
        onTheme={setTheme}
        onClearScene={clearScene}
        gestureUi={gestureUi}
        error={error}
      />
    </div>
  );
}
