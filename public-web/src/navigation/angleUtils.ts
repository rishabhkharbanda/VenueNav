/**
 * 2D turn classification using the angle between path segments and the sign of
 * the cross product (y-down / screen space as in the map data).
 */
export type TurnSide = "left" | "right" | "straight" | "back";

/** Below this (degrees), treat as “continue straight” with merged distance. */
export const STRAIGHT_MAX_DEG = 20;
/** At or above this, treat as U-turn. */
export const U_TURN_MIN_DEG = 150;

export function angleBetweenVectorsRad(ax: number, ay: number, bx: number, by: number): number {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-8 || lb < 1e-8) return 0;
  const cax = ax / la;
  const cay = ay / la;
  const cbx = bx / lb;
  const cby = by / lb;
  const cross = cax * cby - cay * cbx;
  const dot = cax * cbx + cay * cby;
  return Math.atan2(cross, dot);
}

export function angleBetweenVectorsDeg(ax: number, ay: number, bx: number, by: number): number {
  return (angleBetweenVectorsRad(ax, ay, bx, by) * 180) / Math.PI;
}

/**
 * y-down: negative cross = turn to your right, positive = turn left
 * (path geometry matches Pixi / stored node coords).
 */
function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Incoming: vector into the joint (toNode - fromNode).
 * Outgoing: vector leaving (fromNode is current, next - current).
 * We compare direction of travel: v1 = toNode - fromPrev, v2 = toNext - toNode
 */
export function classifyTurn(
  v1x: number,
  v1y: number,
  v2x: number,
  v2y: number
): { kind: "straight" | "turn" | "uturn"; side: TurnSide; angleDeg: number } {
  const ad = Math.abs(angleBetweenVectorsDeg(v1x, v1y, v2x, v2y));
  if (ad < STRAIGHT_MAX_DEG) {
    return { kind: "straight", side: "straight", angleDeg: ad };
  }
  if (ad > U_TURN_MIN_DEG) {
    return { kind: "uturn", side: "back", angleDeg: ad };
  }
  const z = cross2(v1x, v1y, v2x, v2y);
  const side: TurnSide = z < 0 ? "right" : z > 0 ? "left" : "right";
  return { kind: "turn", side, angleDeg: ad };
}
