import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";
import { getFootprint, nearestNodeId } from "@/lib/graphModel";

export function runShopAccess(ctx: ValidationContext): ValidationIssue[] {
  const { nodes, shops, idSet, shopAccessMaxDist } = ctx;
  const issues: ValidationIssue[] = [];
  let k = 0;

  for (const s of shops) {
    if (!s.location_node) {
      issues.push({
        id: makeIssueId("SHOP_NO_NODE", k++),
        code: "SHOP_NO_NODE",
        severity: "error",
        message: `Shop “${s.name}” has no access node (location_node).`,
        relatedIds: [s.id],
      });
      continue;
    }
    if (!idSet.has(s.location_node)) {
      issues.push({
        id: makeIssueId("SHOP_BAD_NODE", k++),
        code: "SHOP_BAD_NODE",
        severity: "error",
        message: `Shop “${s.name}” has invalid access node: ${s.location_node}`,
        relatedIds: [s.id, s.location_node],
      });
    }
  }

  for (const s of shops) {
    if (!s.location_node || !idSet.has(s.location_node)) continue;
    const poly = getFootprint(s);
    if (poly.length < 3) {
      issues.push({
        id: makeIssueId("SHOP_NO_POLYGON", k++),
        code: "SHOP_NO_POLYGON",
        severity: "error",
        message: `Shop “${s.name}” needs a closed polygon (≥3 points) for its footprint.`,
        relatedIds: [s.id],
      });
    }
  }

  for (const s of shops) {
    const poly = getFootprint(s);
    if (poly.length < 2) continue; // need ≥3 for valid shop polygon; centroid check for partial polys
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p.x;
      cy += p.y;
    }
    cx /= poly.length;
    cy /= poly.length;
    if (!nodes.length) continue;
    const nn = nearestNodeId(cx, cy, nodes);
    if (!nn) continue;
    const n = nodes.find((x) => x.id === nn);
    if (!n) continue;
    const d = Math.hypot(n.x - cx, n.y - cy);
    if (d > shopAccessMaxDist) {
      issues.push({
        id: makeIssueId("SHOP_CENTROID_FAR", k++, s.id),
        code: "SHOP_CENTROID_FAR",
        severity: "warning",
        message: `Shop “${s.name}” area center is over ${shopAccessMaxDist} units from the nearest node (${d.toFixed(0)}u). Check placement or add a path.`,
        relatedIds: [s.id, nn],
        focus: { x: cx, y: cy },
      });
    }
  }

  for (const s of shops) {
    if (!s.name || !s.name.trim()) {
      issues.push({
        id: makeIssueId("SHOP_NAME_EMPTY", k++),
        code: "SHOP_NAME_EMPTY",
        severity: "error",
        message: "A shop has an empty name.",
        relatedIds: [s.id],
      });
    }
  }

  return issues;
}
