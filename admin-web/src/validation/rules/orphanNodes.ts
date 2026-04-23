import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";

export function runOrphanNodes(ctx: ValidationContext, degree: Map<string, number>): ValidationIssue[] {
  const { nodes } = ctx;
  const issues: ValidationIssue[] = [];
  let k = 0;
  if (nodes.length <= 1) return issues;
  for (const n of nodes) {
    if ((degree.get(n.id) ?? 0) === 0) {
      issues.push({
        id: makeIssueId("ORPHAN_NODE", k++),
        code: "ORPHAN_NODE",
        severity: "error",
        message: `Node has no edges: ${n.id}`,
        relatedIds: [n.id],
        focus: { x: n.x, y: n.y },
      });
    }
  }
  return issues;
}
