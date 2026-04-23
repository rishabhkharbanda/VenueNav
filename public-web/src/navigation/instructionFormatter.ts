import { formatDistance } from "@/lib/routeFormat";
import type { TurnSide } from "./angleUtils";
export function formatStartLine(label: string): string {
  return `Start at ${label}.`;
}

export function formatWalkLine(distance: number, unit: string | null | undefined, compact = false): string {
  if (distance <= 0) return "Continue ahead.";
  const d = formatDistance(distance, unit);
  if (compact) {
    return `Go ${d}.`;
  }
  return `Follow the path for about ${d}.`;
}

export function formatTurnLine(
  side: Exclude<TurnSide, "straight">,
  angleDeg: number,
  landmark: string | null
): string {
  const near = landmark ? ` near ${landmark}` : "";
  if (side === "back") {
    return `Make a U-turn${near}.`;
  }
  const a = Math.round(angleDeg);
  if (a >= 75) {
    return `Turn ${side} sharply${near}.`;
  }
  if (a >= 40) {
    return `Turn ${side}${near}.`;
  }
  return `Turn slightly to the ${side}${near}.`;
}

export function formatArrivalLine(shopName: string | null): string {
  if (shopName) {
    return `You have reached ${shopName}.`;
  }
  return "You have reached your destination.";
}
