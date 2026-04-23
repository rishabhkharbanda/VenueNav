import type { GraphNode, MapShop, GraphEdge } from "@/types/mapGraph";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  code: string;
  severity: Severity;
  message: string;
  relatedIds?: string[];
  /** Map-space point for “zoom to” / focus */
  focus?: { x: number; y: number };
}

export interface ValidationContext {
  nodes: GraphNode[];
  edges: { from: string; to: string }[];
  edgesFull: GraphEdge[];
  shops: MapShop[];
  idSet: Set<string>;
  /** Max distance (map units) from shop centroid to any node to count as “accessible” */
  shopAccessMaxDist: number;
  /** Node pairs closer than this are overlapping (warning) */
  overlapEps: number;
  /** Zero-length edge if distance < this */
  zeroEdgeEps: number;
  /** Max number of dead-end warning rows (avoid 500+ rows) */
  deadEndCap: number;
}

export function buildDegreeMap(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  idSet: Set<string>
): Map<string, number> {
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  return degree;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

export function makeIssueId(code: string, index: number, extra?: string): string {
  return extra ? `${code}-${index}-${extra}` : `${code}-${index}`;
}
