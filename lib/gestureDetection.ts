import { dist2, type Point2 } from "./geometry";

/** Subset of MediaPipe normalized image landmark (0–1). */
export type HandLandmark = { x: number; y: number; z?: number };

/** MediaPipe hand landmark indices (single hand). */
export const LM = {
  WRIST: 0,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
} as const;

/**
 * Heuristic: index is "raised" / extended when the tip sits farther from the MCP
 * knuckle than the PIP joint does — same idea as curl detection used in air-pointer UIs.
 * Works across many wrist orientations better than raw screen-space y comparisons.
 */
export function isIndexFingerExtended(
  landmarks: HandLandmark[],
  minRatio = 1.08,
): boolean {
  const mcp = landmarks[LM.INDEX_MCP];
  const pip = landmarks[LM.INDEX_PIP];
  const tip = landmarks[LM.INDEX_TIP];
  if (!mcp || !pip || !tip) return false;

  const dTip = dist2(tip as Point2, mcp as Point2);
  const dPip = dist2(pip as Point2, mcp as Point2);
  return dTip > dPip * minRatio;
}

/**
 * Optional quality gate: require a minimum spread so we ignore jittery partial detections.
 */
export function handScale(landmarks: HandLandmark[]): number {
  const wrist = landmarks[LM.WRIST];
  const middleMcp = landmarks[9];
  if (!wrist || !middleMcp) return 0;
  return dist2(wrist as Point2, middleMcp as Point2);
}

export function isConfidentDrawingPose(
  landmarks: HandLandmark[],
  minHandScale = 0.04,
): boolean {
  return handScale(landmarks) >= minHandScale && isIndexFingerExtended(landmarks);
}

/** Mirror X so canvas matches a horizontally flipped webcam preview. */
export function mirrorNormalizedX(x: number): number {
  return 1 - x;
}
