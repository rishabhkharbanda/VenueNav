import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";
import { euclidean } from "@/lib/graphModel";

export function runEdgeRules(ctx: ValidationContext): ValidationIssue[] {
  const { nodes, edgesFull, idSet, zeroEdgeEps } = ctx;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const issues: ValidationIssue[] = [];
  let k = 0;
  const seen = new Set<string>();

  for (const e of edgesFull) {
    if (!e.from || !e.to) {
      issues.push({
        id: makeIssueId("EDGE_BAD", k++),
        code: "EDGE_BAD",
        severity: "error",
        message: "Edge is missing from or to node id",
        relatedIds: [e.from, e.to].filter(Boolean),
      });
      continue;
    }
    if (e.from === e.to) {
      const n = byId.get(e.from);
      issues.push({
        id: makeIssueId("SELF_LOOP", k++),
        code: "SELF_LOOP",
        severity: "error",
        message: `Self-loop edge on node ${e.from}`,
        relatedIds: [e.from],
        focus: n ? { x: n.x, y: n.y } : undefined,
      });
      continue;
    }
    if (!idSet.has(e.from) || !idSet.has(e.to)) {
      issues.push({
        id: makeIssueId("EDGE_UNKNOWN_NODE", k++),
        code: "EDGE_UNKNOWN_NODE",
        severity: "error",
        message: `Edge references missing node: ${e.from} → ${e.to}`,
        relatedIds: [e.from, e.to],
      });
      continue;
    }
    const u = byId.get(e.from);
    const v = byId.get(e.to);
    if (u && v) {
      const d = euclidean(u, v);
      if (d < zeroEdgeEps) {
        const key = [e.from, e.to].sort().join("::");
        if (!seen.has("zero:" + key)) {
          seen.add("zero:" + key);
          issues.push({
            id: makeIssueId("ZERO_LENGTH_EDGE", k++),
            code: "ZERO_LENGTH_EDGE",
            severity: "error",
            message: `Zero-length or degenerate edge ${e.from} — ${e.to}`,
            relatedIds: [e.from, e.to],
            focus: { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 },
          });
        }
      }
    }
  }

  const firstUndirected = new Set<string>();
  for (const e of edgesFull) {
    if (!e.from || !e.to || e.from === e.to) continue;
    const k2 = [e.from, e.to].sort().join("::");
    if (firstUndirected.has(k2)) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      issues.push({
        id: makeIssueId("DUPLICATE_EDGE", k++),
        code: "DUPLICATE_EDGE",
        severity: "error",
        message: `Duplicate edge between ${e.from} and ${e.to}`,
        relatedIds: [e.from, e.to],
        focus: a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : undefined,
      });
    } else {
      firstUndirected.add(k2);
    }
  }

  return issues;
}
