/** Walking speed for ETA when unit is meters (m/s). */
const WALK_MPS = 1.35;

export function formatDistance(cost: number, unit: string | null | undefined): string {
  const u = (unit || "").toLowerCase();
  if (u === "m" || u === "meter" || u === "meters") {
    if (cost < 1000) return `${Math.round(cost)} m`;
    return `${(cost / 1000).toFixed(2)} km`;
  }
  if (u === "ft" || u === "feet") {
    return `${Math.round(cost)} ft`;
  }
  return `${cost.toFixed(0)} ${unit || "map units"}`;
}

export function estimateWalkSeconds(distanceInMeters: number, unit: string | null | undefined): number {
  const u = (unit || "").toLowerCase();
  if (u === "m" || u === "meter" || u === "meters") {
    return Math.round(distanceInMeters / WALK_MPS);
  }
  if (u === "ft" || u === "feet") {
    return Math.round((distanceInMeters * 0.3048) / WALK_MPS);
  }
  return Math.round(distanceInMeters / (WALK_MPS * 2)); // rough: treat cost as "abstract units"
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s walk`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
