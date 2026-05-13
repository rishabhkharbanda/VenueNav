"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { HandLandmark } from "@/lib/gestureDetection";
import {
  isConfidentDrawingPose,
  mirrorNormalizedX,
  LM,
} from "@/lib/gestureDetection";
import type { Point2 } from "@/lib/geometry";
import { emaPoint } from "@/lib/smoothing";

const MEDIAPIPE_HANDS_VERSION = "0.4.1675469240";

export type HandTrackerPayload = {
  indexTipNorm: Point2 | null;
  isDrawing: boolean;
  tracking: boolean;
};

export type HandTrackerHandle = {
  stop: () => void;
};

type Props = {
  onHandFrame: (payload: HandTrackerPayload) => void;
  onError?: (message: string) => void;
  className?: string;
};

/**
 * Webcam + MediaPipe Hands. Runs entirely on the client.
 * Emits normalized (0–1) tip coordinates with X mirrored to match a flipped preview.
 */
export const HandTracker = forwardRef<HandTrackerHandle, Props>(function HandTracker(
  { onHandFrame, onError, className },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<{ stop: () => void } | null>(null);
  const emaRef = useRef<Point2 | null>(null);
  const stoppedRef = useRef(false);
  const onHandFrameRef = useRef(onHandFrame);
  const onErrorRef = useRef(onError);
  onHandFrameRef.current = onHandFrame;
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    stop: () => {
      stoppedRef.current = true;
      cameraRef.current?.stop();
      cameraRef.current = null;
    },
  }));

  useEffect(() => {
    stoppedRef.current = false;
    const video = videoRef.current;
    if (!video) return;

    let handsInstance: { close?: () => void; send: (input: { image: HTMLVideoElement }) => Promise<void> } | null =
      null;

    (async () => {
      try {
        const [{ Hands }, { Camera }] = await Promise.all([
          import("@mediapipe/hands"),
          import("@mediapipe/camera_utils"),
        ]);

        const hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.55,
        });

        hands.onResults((results) => {
          if (stoppedRef.current) return;
          const lm = results.multiHandLandmarks?.[0] as HandLandmark[] | undefined;
          const tracking = Boolean(lm?.length);
          const isDrawing = Boolean(lm && isConfidentDrawingPose(lm));

          let indexTipNorm: Point2 | null = null;
          if (lm) {
            const tip = lm[LM.INDEX_TIP];
            indexTipNorm = {
              x: mirrorNormalizedX(tip.x),
              y: tip.y,
            };
            indexTipNorm = emaPoint(emaRef.current, indexTipNorm, 0.42);
            emaRef.current = indexTipNorm;
          } else {
            emaRef.current = null;
          }

          onHandFrameRef.current({ indexTipNorm, isDrawing, tracking });
        });

        handsInstance = hands;

        const camera = new Camera(video, {
          onFrame: async () => {
            if (stoppedRef.current || !handsInstance) return;
            await handsInstance.send({ image: video });
          },
          width: 1280,
          height: 720,
        });

        cameraRef.current = camera;
        await camera.start();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      stoppedRef.current = true;
      cameraRef.current?.stop();
      cameraRef.current = null;
      handsInstance?.close?.();
      handsInstance = null;
      emaRef.current = null;
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      playsInline
      muted
      autoPlay
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
});

HandTracker.displayName = "HandTracker";
