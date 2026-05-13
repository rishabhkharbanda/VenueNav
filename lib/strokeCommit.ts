import type { MutableRefObject } from "react";
import type { Point2 } from "@/lib/geometry";

/**
 * Moves the active stroke into `strokesRef` when valid. Clears the active buffer.
 * Returns the committed stroke, or null if too short.
 */
export function commitActiveStroke(
  strokesRef: MutableRefObject<Point2[][]>,
  currentStrokeRef: MutableRefObject<Point2[]>,
): Point2[] | null {
  const cur = currentStrokeRef.current;
  currentStrokeRef.current = [];
  if (cur.length <= 1) return null;
  strokesRef.current = [...strokesRef.current, cur];
  return cur;
}
