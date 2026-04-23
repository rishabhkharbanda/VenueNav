/**
 * Dijkstra on undirected graph (matches backend all-positive weights) for draft route preview.
 */
import type { GraphEdge, GraphNode } from "@/types/mapGraph";

type NB = { to: string; w: number };

function buildUndirected(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, NB[]> {
  const adj = new Map<string, NB[]>();
  const add = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, w });
    adj.get(b)!.push({ to: a, w });
  };
  for (const e of edges) add(e.from, e.to, e.weight);
  for (const n of nodes) if (!adj.has(n.id)) adj.set(n.id, []);
  return adj;
}

export function shortestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  start: string,
  end: string
): { path: string[]; cost: number } | null {
  if (start === end) return { path: [start], cost: 0 };
  const adj = buildUndirected(nodes, edges);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const n of nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  if (!dist.has(start) || !dist.has(end)) return null;
  dist.set(start, 0);
  type T = { d: number; u: string };
  const pq: T[] = [{ d: 0, u: start }];
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { d, u } = pq.shift()!;
    if (d > (dist.get(u) ?? Infinity)) continue;
    if (u === end) break;
    for (const { to, w } of adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        pq.push({ d: nd, u: to });
      }
    }
  }
  if ((dist.get(end) ?? Infinity) === Infinity) return null;
  const path: string[] = [];
  let c: string | null = end;
  while (c) {
    path.push(c);
    c = prev.get(c) ?? null;
  }
  path.reverse();
  return { path, cost: dist.get(end)! };
}
