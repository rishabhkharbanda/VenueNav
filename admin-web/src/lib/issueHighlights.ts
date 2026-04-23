import { makeEdgeId } from "@/lib/graphModel";
import type { ValidationIssue } from "@/validation/types";

export type HighlightLevel = "error" | "warning" | null;

const rank = (s: HighlightLevel) => (s === "error" ? 2 : s === "warning" ? 1 : 0);
function bump(
  m: Map<string, HighlightLevel>,
  id: string,
  sev: "error" | "warning"
) {
  const cur = m.get(id) ?? null;
  if (rank(sev) > rank(cur)) m.set(id, sev);
}

/**
 * For each entity id, the worst severity among issues that reference it.
 */
export function buildEntityHighlights(
  issues: ValidationIssue[],
  nodeIds: Set<string>,
  shopIds: Set<string>
): {
  nodeSeverity: Map<string, HighlightLevel>;
  edgeSeverity: Map<string, HighlightLevel>;
  shopSeverity: Map<string, HighlightLevel>;
} {
  const nodeSeverity = new Map<string, HighlightLevel>();
  const edgeSeverity = new Map<string, HighlightLevel>();
  const shopSeverity = new Map<string, HighlightLevel>();
  for (const i of issues) {
    const ids = i.relatedIds;
    if (!ids?.length) continue;
    const sev = i.severity;
    if (sev !== "error" && sev !== "warning") continue;
    for (const id of ids) {
      if (nodeIds.has(id)) bump(nodeSeverity, id, sev);
      if (shopIds.has(id)) bump(shopSeverity, id, sev);
    }
  }
  for (const i of issues) {
    if (i.code === "DUPLICATE_EDGE" || i.code === "ZERO_LENGTH_EDGE") {
      const ids = i.relatedIds;
      if (ids && ids.length >= 2) {
        const a = nodeIds.has(ids[0]!) ? ids[0] : null;
        const b = nodeIds.has(ids[1]!) ? ids[1] : null;
        if (a && b) {
          const k = makeEdgeId(a, b);
          const sev = i.severity as "error" | "warning";
          const cur = edgeSeverity.get(k) ?? null;
          if (rank(sev) > rank(cur)) edgeSeverity.set(k, sev);
        }
      }
    }
  }
  return { nodeSeverity, edgeSeverity, shopSeverity };
}
