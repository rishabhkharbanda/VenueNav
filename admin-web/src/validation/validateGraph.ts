import { runGraphValidation } from "./graphValidator";
import type { MapPayload, GraphNode, MapShop, GraphEdge } from "@/types/mapGraph";
import type { ValidationIssue, ValidationResult } from "./types";
import type { ValidateOptions } from "./graphValidator";

export { runGraphValidation, hasBlockingErrorFromResult, type ValidateOptions } from "./graphValidator";
export type { ValidationIssue, Severity, ValidationResult } from "./types";

/**
 * @deprecated prefer runGraphValidation(map) or validateMapPayload
 */
export function validateGraph(
  nodes: GraphNode[],
  edges: { from: string; to: string }[],
  shops: MapShop[]
): ValidationIssue[] {
  const graph: MapPayload = {
    map_id: "validate",
    map_version_id: "v",
    nodes,
    edges: edges as GraphEdge[],
    shops,
  };
  return runGraphValidation(graph).issues;
}

export function validateMapPayload(map: MapPayload, opts?: ValidateOptions): ValidationResult {
  return runGraphValidation(map, opts);
}

export function hasBlockingError(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
