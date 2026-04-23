import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";

export function runOverlappingNodes(ctx: ValidationContext): ValidationIssue[] {
  const { nodes, overlapEps } = ctx;
  const issues: ValidationIssue[] = [];
  const eps2 = overlapEps * overlapEps;
  let k = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const d2 = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
      if (d2 > 0 && d2 < eps2) {
        issues.push({
          id: makeIssueId("NODE_OVERLAP", k++, `${a.id}-${b.id}`),
          code: "NODE_OVERLAP",
          severity: "warning",
          message: `Nodes are very close and may be duplicates: ${a.id} and ${b.id}`,
          relatedIds: [a.id, b.id],
          focus: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        });
      }
    }
  }
  return issues;
}
