import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";
export function runDeadEnds(degree: Map<string, number>, ctx: ValidationContext): ValidationIssue[] {
  const { nodes, deadEndCap } = ctx;
  const issues: ValidationIssue[] = [];
  if (nodes.length < 2) return issues;
  let k = 0;
  const dead = nodes.filter((n) => (degree.get(n.id) ?? 0) === 1);
  for (let i = 0; i < Math.min(dead.length, deadEndCap); i++) {
    const n = dead[i]!;
    issues.push({
      id: makeIssueId("DEAD_END", k++),
      code: "DEAD_END",
      severity: "warning",
      message: `Node is a dead end (single connection). Review: ${n.id}`,
      relatedIds: [n.id],
      focus: { x: n.x, y: n.y },
    });
  }
  if (dead.length > deadEndCap) {
    issues.push({
      id: makeIssueId("DEAD_END_TRAIL", k++),
      code: "DEAD_END_MANY",
      severity: "warning",
      message: `Additional dead-end nodes omitted (showing first ${deadEndCap} of ${dead.length}).`,
    });
  }
  return issues;
}
