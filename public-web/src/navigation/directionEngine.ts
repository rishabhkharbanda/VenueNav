import type { GraphNode, MapPayload, MapShop } from "@/types/map";
import { shopCentroid, findEntranceNode } from "@/lib/graphModel";
import { formatArrivalLine, formatStartLine, formatTurnLine, formatWalkLine } from "./instructionFormatter";
import { classifyTurn } from "./angleUtils";
import type { TurnSide } from "./angleUtils";

export type EngineStep =
  | { type: "start"; nodeId: string; line: string }
  | { type: "walk"; distance: number; line: string }
  | { type: "turn"; nodeId: string; side: Exclude<TurnSide, "straight">; angleDeg: number; line: string }
  | { type: "arrive"; line: string };

function byId(nodes: GraphNode[]) {
  const m = new Map<string, GraphNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

export function getUndirectedEdgeWeight(
  a: string,
  b: string,
  edges: MapPayload["edges"]
): number | null {
  for (const e of edges) {
    if (e.from === a && e.to === b) return e.weight;
    if (e.to === a && e.from === b) return e.weight;
  }
  return null;
}

function startLabel(
  firstId: string,
  nodes: Map<string, GraphNode>,
  ent: ReturnType<typeof findEntranceNode>
): string {
  const n = nodes.get(firstId);
  if (!n) return "the starting point";
  if (n.id === ent?.id) {
    if (n.label && n.label.trim()) return n.label.trim();
    return "the entrance";
  }
  if (n.type === "entrance" && n.label) return n.label.trim();
  if (n.label && n.label.trim()) return n.label.trim();
  if (n.type === "entrance" || n.type === "exit") {
    return n.type === "entrance" ? "the entrance" : "the exit";
  }
  return "your starting point";
}

function landmarkNameForNode(
  node: GraphNode,
  shops: MapShop[],
  nearbyThreshold: number
): string | null {
  const direct = shops.filter((s) => s.location_node === node.id);
  if (direct.length > 0) {
    if (direct.length === 1) return direct[0]!.name;
    return direct[0]!.name;
  }
  let best: { name: string; d2: number } | null = null;
  for (const s of shops) {
    const c = shopCentroid(s);
    if (!c) continue;
    const d2 = (c.x - node.x) ** 2 + (c.y - node.y) ** 2;
    if (d2 > nearbyThreshold * nearbyThreshold) continue;
    if (!best || d2 < best.d2) best = { name: s.name, d2 };
  }
  return best?.name ?? null;
}

/**
 * Heuristic: shops within this map-unit radius of the turn can be used as a landmark.
 */
function landmarkThreshold(avgSegLen: number): number {
  return Math.max(35, Math.min(200, avgSegLen * 3.5));
}

export function buildDirectionSteps(
  pathNodeIds: string[],
  payload: MapPayload,
  opts: { destinationShopName: string | null }
): EngineStep[] {
  if (pathNodeIds.length < 2) return [];

  const nodeMap = byId(payload.nodes);
  const ent = findEntranceNode(payload.nodes);
  const edges = payload.edges;
  const out: EngineStep[] = [];

  const segWeights: number[] = [];
  for (let k = 0; k < pathNodeIds.length - 1; k++) {
    const a = pathNodeIds[k]!;
    const b = pathNodeIds[k + 1]!;
    const w = getUndirectedEdgeWeight(a, b, edges);
    segWeights.push(w ?? 0);
  }
  const sumW = segWeights.reduce((a, b) => a + b, 0);
  const avgLen = sumW / Math.max(1, segWeights.length);
  const lmDist = landmarkThreshold(avgLen);

  const getPos = (id: string): { x: number; y: number } | null => {
    const n = nodeMap.get(id);
    return n ? { x: n.x, y: n.y } : null;
  };

  out.push({
    type: "start",
    nodeId: pathNodeIds[0]!,
    line: formatStartLine(startLabel(pathNodeIds[0]!, nodeMap, ent)),
  });

  let walkAcc = 0;
  for (let k = 0; k < pathNodeIds.length - 1; k++) {
    walkAcc += segWeights[k]!;

    if (k > pathNodeIds.length - 3) {
      continue;
    }

    const prev = getPos(pathNodeIds[k]!);
    const cur = getPos(pathNodeIds[k + 1]!);
    const nxt = getPos(pathNodeIds[k + 2]!);
    if (!prev || !cur || !nxt) continue;

    const v1x = cur.x - prev.x;
    const v1y = cur.y - prev.y;
    const v2x = nxt.x - cur.x;
    const v2y = nxt.y - cur.y;
    const t = classifyTurn(v1x, v1y, v2x, v2y);
    if (t.kind === "straight") {
      continue;
    }

    if (walkAcc > 0) {
      out.push({
        type: "walk",
        distance: walkAcc,
        line: formatWalkLine(walkAcc, payload.unit, false),
      });
    }
    walkAcc = 0;

    const turnNode = nodeMap.get(pathNodeIds[k + 1]!);
    const lm = turnNode ? landmarkNameForNode(turnNode, payload.shops, lmDist) : null;
    if (t.kind === "uturn" || t.side === "back") {
      out.push({
        type: "turn",
        nodeId: pathNodeIds[k + 1]!,
        side: "back",
        angleDeg: t.angleDeg,
        line: formatTurnLine("back", t.angleDeg, lm),
      });
    } else {
      const s = t.side;
      if (s === "left" || s === "right") {
        out.push({
          type: "turn",
          nodeId: pathNodeIds[k + 1]!,
          side: s,
          angleDeg: t.angleDeg,
          line: formatTurnLine(s, t.angleDeg, lm),
        });
      }
    }
  }

  if (walkAcc > 0) {
    out.push({
      type: "walk",
      distance: walkAcc,
      line: formatWalkLine(walkAcc, payload.unit, false),
    });
  }

  out.push({ type: "arrive", line: formatArrivalLine(opts.destinationShopName) });
  return out;
}
