import type { GraphNode, MapPayload } from "@/types/mapGraph";
import { buildDegreeMap, type ValidationContext, type ValidationResult, type ValidationIssue } from "./types";
import { runEdgeRules } from "./rules/edgeRules";
import { runOrphanNodes } from "./rules/orphanNodes";
import { runConnectivity } from "./rules/connectivity";
import { runShopAccess } from "./rules/shopAccess";
import { runDeadEnds } from "./rules/deadEnds";
import { runOverlappingNodes } from "./rules/overlappingNodes";
import { enrichIssueFoci } from "./enrichFoci";
import {
  DEFAULT_SHOP_ACCESS_MAX_DIST,
  DEFAULT_OVERLAP_EPS,
  DEFAULT_ZERO_EDGE_EPS,
  DEAD_END_WARNING_CAP,
} from "./constants";

export interface ValidateOptions {
  shopAccessMaxDist?: number;
  overlapEps?: number;
  zeroEdgeEps?: number;
  deadEndCap?: number;
}

function splitBySeverity(issues: ValidationIssue[]): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  for (const i of issues) {
    if (i.severity === "error") errors.push(i);
    else warnings.push(i);
  }
  return { errors, warnings };
}

function buildContext(
  nodes: GraphNode[],
  edges: { from: string; to: string }[],
  edgesFull: import("@/types/mapGraph").GraphEdge[],
  shops: import("@/types/mapGraph").MapShop[],
  o: ValidateOptions
): ValidationContext {
  const idSet = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges,
    edgesFull,
    shops,
    idSet,
    shopAccessMaxDist: o.shopAccessMaxDist ?? DEFAULT_SHOP_ACCESS_MAX_DIST,
    overlapEps: o.overlapEps ?? DEFAULT_OVERLAP_EPS,
    zeroEdgeEps: o.zeroEdgeEps ?? DEFAULT_ZERO_EDGE_EPS,
    deadEndCap: o.deadEndCap ?? DEAD_END_WARNING_CAP,
  };
}

/**
 * Main validation entry. Runs all rules, assigns stable ids, and enriches focus points.
 */
export function runGraphValidation(graph: MapPayload, opts: ValidateOptions = {}): ValidationResult {
  const o = {
    ...opts,
  };
  const { nodes, edges, shops } = graph;
  const idSet = new Set(nodes.map((n) => n.id));
  const ctx = buildContext(nodes, edges, graph.edges, shops, o);

  const all: ValidationIssue[] = [];
  all.push(...runEdgeRules(ctx));

  const degree = buildDegreeMap(nodes, edges, idSet);
  all.push(...runOrphanNodes(ctx, degree));
  const { issues: connectIssues } = runConnectivity(ctx);
  all.push(...connectIssues);
  all.push(...runShopAccess(ctx));
  all.push(...runDeadEnds(degree, ctx));
  all.push(...runOverlappingNodes(ctx));

  const enriched = enrichIssueFoci(graph, all);
  const { errors, warnings } = splitBySeverity(enriched);
  return {
    errors,
    warnings,
    issues: [...errors, ...warnings],
  };
}

export function hasBlockingErrorFromResult(r: ValidationResult): boolean {
  return r.errors.length > 0;
}
