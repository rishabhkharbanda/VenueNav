import type { GraphNode } from "@/types/mapGraph";
import type { ValidationContext, ValidationIssue } from "@/validation/types";
import { makeIssueId } from "@/validation/types";
/**
 * Build undirected adjacency. Skips bad edges.
 */
export function buildAdj(
  nodes: GraphNode[],
  edges: { from: string; to: string }[],
  idSet: Set<string>
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  }
  return adj;
}

function components(nodes: GraphNode[], adj: Map<string, Set<string>>): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const comp: string[] = [];
    const st = [n.id];
    seen.add(n.id);
    while (st.length) {
      const u = st.pop()!;
      comp.push(u);
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v);
          st.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

export function runConnectivity(
  ctx: ValidationContext
): { issues: ValidationIssue[]; compCount: number; compOfNode: Map<string, number> } {
  const { nodes, edges, idSet, shops } = ctx;
  const issues: ValidationIssue[] = [];
  let k = 0;
  const adj = buildAdj(nodes, edges, idSet);
  const comps = components(nodes, adj);
  const compOfNode = new Map<string, number>();
  comps.forEach((c, i) => c.forEach((id) => compOfNode.set(id, i)));

  if (nodes.length > 1 && edges.length === 0) {
    issues.push({
      id: makeIssueId("NO_EDGES", k++),
      code: "NO_EDGES",
      severity: "error",
      message: "Multiple nodes but no edges — graph is disconnected.",
    });
    return { issues, compCount: nodes.length, compOfNode };
  }

  if (comps.length > 1 && nodes.length > 0) {
    issues.push({
      id: makeIssueId("DISCONNECTED", k++),
      code: "DISCONNECTED",
      severity: "error",
      message: `Graph has ${comps.length} connected components; walking navigation needs a single walkable area.`,
    });
  }

  const locNodes = shops
    .map((s) => s.location_node)
    .filter((id) => id && idSet.has(id!)) as string[];
  if (locNodes.length >= 2) {
    const c0 = compOfNode.get(locNodes[0]!);
    const spread = locNodes.some((id) => compOfNode.get(id) !== c0);
    if (spread) {
      issues.push({
        id: makeIssueId("SHOPS_IN_MULTIPLE_COMPONENTS", k++),
        code: "SHOPS_IN_MULTIPLE_COMPONENTS",
        severity: "error",
        message: "Shops’ access nodes are not all in the same connected component. Players cannot reach all shops on foot.",
        relatedIds: locNodes,
      });
    }
  }

  return { issues, compCount: comps.length, compOfNode };
}
