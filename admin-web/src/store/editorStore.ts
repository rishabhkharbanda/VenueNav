import { create } from "zustand";
import { nanoid } from "nanoid";
import type { MapPayload, GraphNode, GraphEdge, MapShop } from "@/types/mapGraph";
import {
  buildPayload,
  recomputeAllEdgeWeights,
  setFootprint,
  getFootprint,
  nearestNodeId,
} from "@/lib/graphModel";
import type { ValidationIssue } from "@/validation/validateGraph";
import { runGraphValidation } from "@/validation/validateGraph";
import {
  connectNearestAcrossComponents,
  attachAllShopsToNearestNode,
  removeOrphanNodes,
  mergeOverlappingNodes,
} from "@/validation/autoFixes";
import { canPlaceNodeAt, snapToGrid } from "@/lib/constraints";
import { DEFAULT_SHOP_ACCESS_MAX_DIST, DEFAULT_NODE_MIN_SEP, DEFAULT_GRID_SIZE } from "@/validation/constants";
import type { EditorMode, EditorPreferences } from "./editorTypes";

export type { EditorMode, EditorPreferences } from "./editorTypes";
export { editorModes } from "./editorTypes";

type EdgeConnect = { a: string | null; b: string | null };

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

export interface EditorState {
  orgId: string;
  mapId: string;
  mapName: string;
  mode: EditorMode;
  graph: MapPayload | null;
  publishedVersion: number | null;
  selectedNodeId: string | null;
  selectedEdgeKey: string | null;
  selectedShopId: string | null;
  edgeConnect: EdgeConnect;
  shopDrawPoints: { x: number; y: number }[];
  routeFrom: string | null;
  routeTo: string | null;
  routePath: string[] | null;
  serverRoutePath: string[] | null;
  cursor: { x: number; y: number };
  world: { scale: number; tx: number; ty: number };
  /** Combined list: errors first, then warnings (for panels) */
  issues: ValidationIssue[];
  validationErrors: ValidationIssue[];
  validationWarnings: ValidationIssue[];
  /** Which issue is selected in the validation panel (drives list highlight) */
  selectedValidationIssueId: string | null;
  /** Shop name for “finish polygon” (must be non-empty) */
  shopNameDraft: string;
  /** Short UX message (constraint rejection, etc.) */
  constraintMessage: string | null;
  /** Hover tooltip in screen pixels (set by map canvas) */
  mapTooltip: { text: string; clientX: number; clientY: number } | null;
  editorPreferences: EditorPreferences;
  isDirty: boolean;
  setContext: (orgId: string, mapId: string, name?: string) => void;
  /** Load from GET /graph — marks clean */
  hydrateGraph: (g: MapPayload) => void;
  updateNode: (id: string, p: Partial<Pick<GraphNode, "type" | "label">>) => void;
  setMode: (m: EditorMode) => void;
  setSelected: (p: { node?: string | null; edge?: string | null; shop?: string | null }) => void;
  setWorld: (w: Partial<{ scale: number; tx: number; ty: number }>) => void;
  setCursor: (c: { x: number; y: number }) => void;
  setIssues: (i: ValidationIssue[]) => void;
  setValidationResult: (e: ValidationIssue[], w: ValidationIssue[]) => void;
  revalidateGraph: () => void;
  setSelectedValidationIssueId: (id: string | null) => void;
  setShopNameDraft: (s: string) => void;
  setEditorPreferences: (p: Partial<EditorPreferences>) => void;
  setConstraintMessage: (m: string | null) => void;
  setMapTooltip: (t: { text: string; clientX: number; clientY: number } | null) => void;
  focusMapToPoint: (mapX: number, mapY: number, viewW: number, viewH: number) => void;
  runAutoFixConnectComponents: () => void;
  runAutoFixAttachShops: () => void;
  runAutoFixRemoveOrphans: () => void;
  runAutoFixMergeOverlaps: () => void;
  addNodeAt: (x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  addEdge: (a: string, b: string) => void;
  removeEdge: (a: string, b: string) => void;
  setEdgeConnect: (a: string | null, b: string | null) => void;
  addShop: (s: MapShop) => void;
  updateShop: (id: string, p: Partial<MapShop>) => void;
  removeShop: (id: string) => void;
  setShopPolygonPoints: (id: string, points: { x: number; y: number }[]) => void;
  pushShopDrawPoint: (x: number, y: number) => void;
  clearShopDraw: () => void;
  finishShopDraw: (name: string) => void;
  setRoute: (a: string | null, b: string | null) => void;
  setRoutePath: (p: string[] | null) => void;
  setServerRoutePath: (p: string[] | null) => void;
  setPublishedVersion: (v: number | null) => void;
  markClean: () => void;
  markDirty: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  orgId: "",
  mapId: "",
  mapName: "Map",
  mode: "select",
  graph: null,
  publishedVersion: null,
  selectedNodeId: null,
  selectedEdgeKey: null,
  selectedShopId: null,
  edgeConnect: { a: null, b: null },
  shopDrawPoints: [],
  routeFrom: null,
  routeTo: null,
  routePath: null,
  serverRoutePath: null,
  cursor: { x: 0, y: 0 },
  world: { scale: 1, tx: 0, ty: 0 },
  issues: [],
  validationErrors: [],
  validationWarnings: [],
  selectedValidationIssueId: null,
  shopNameDraft: "New shop",
  constraintMessage: null,
  mapTooltip: null,
  editorPreferences: {
    gridSnap: false,
    gridSize: DEFAULT_GRID_SIZE,
    minNodeSep: DEFAULT_NODE_MIN_SEP,
    shopAccessMaxDist: DEFAULT_SHOP_ACCESS_MAX_DIST,
  },
  isDirty: false,

  setContext: (orgId, mapId, name) => set({ orgId, mapId, mapName: name ?? "Map" }),
  hydrateGraph: (g) =>
    set({
      graph: g,
      isDirty: false,
      issues: [],
      validationErrors: [],
      validationWarnings: [],
      selectedValidationIssueId: null,
    }),
  updateNode: (id, p) => {
    const g = get().graph;
    if (!g) return;
    const nodes = g.nodes.map((n) => (n.id === id ? { ...n, ...p } : n));
    set({ graph: buildPayload(g, { nodes }), isDirty: true });
  },
  setMode: (m) =>
    set((s) => ({
      mode: m,
      edgeConnect: m === "addEdge" ? { a: null, b: null } : s.edgeConnect,
    })),
  setSelected: ({ node, edge, shop }) =>
    set({
      selectedNodeId: node !== undefined ? node : get().selectedNodeId,
      selectedEdgeKey: edge !== undefined ? edge : get().selectedEdgeKey,
      selectedShopId: shop !== undefined ? shop : get().selectedShopId,
    }),
  setWorld: (w) => set((s) => ({ world: { ...s.world, ...w } })),
  setCursor: (c) => set({ cursor: c }),
  setIssues: (i) =>
    set({
      issues: i,
      validationErrors: i.filter((x) => x.severity === "error"),
      validationWarnings: i.filter((x) => x.severity === "warning"),
    }),
  setValidationResult: (errors, warnings) =>
    set({
      validationErrors: errors,
      validationWarnings: warnings,
      issues: [...errors, ...warnings],
    }),
  revalidateGraph: () => {
    const g = get().graph;
    if (!g) return;
    const p = get().editorPreferences;
    const r = runGraphValidation(g, {
      shopAccessMaxDist: p.shopAccessMaxDist,
    });
    set({
      validationErrors: r.errors,
      validationWarnings: r.warnings,
      issues: r.issues,
    });
  },
  setSelectedValidationIssueId: (id) => set({ selectedValidationIssueId: id }),
  setShopNameDraft: (s) => set({ shopNameDraft: s }),
  setEditorPreferences: (patch) =>
    set((s) => ({ editorPreferences: { ...s.editorPreferences, ...patch } })),
  setConstraintMessage: (m) => set({ constraintMessage: m }),
  setMapTooltip: (t) => set({ mapTooltip: t }),
  focusMapToPoint: (mapX, mapY, viewW, viewH) => {
    const s = get().world.scale;
    set({
      world: {
        ...get().world,
        tx: viewW / 2 - mapX * s,
        ty: viewH / 2 - mapY * s,
      },
    });
  },
  runAutoFixConnectComponents: () => {
    const g0 = get().graph;
    if (!g0) return;
    const next = connectNearestAcrossComponents(g0);
    const p = get().editorPreferences;
    const r = runGraphValidation(next, { shopAccessMaxDist: p.shopAccessMaxDist });
    set({
      graph: next,
      isDirty: true,
      validationErrors: r.errors,
      validationWarnings: r.warnings,
      issues: r.issues,
    });
  },
  runAutoFixAttachShops: () => {
    const g0 = get().graph;
    if (!g0) return;
    const next = attachAllShopsToNearestNode(g0);
    const p = get().editorPreferences;
    const r = runGraphValidation(next, { shopAccessMaxDist: p.shopAccessMaxDist });
    set({
      graph: next,
      isDirty: true,
      validationErrors: r.errors,
      validationWarnings: r.warnings,
      issues: r.issues,
    });
  },
  runAutoFixRemoveOrphans: () => {
    const g0 = get().graph;
    if (!g0) return;
    const next = removeOrphanNodes(g0);
    const p = get().editorPreferences;
    const r = runGraphValidation(next, { shopAccessMaxDist: p.shopAccessMaxDist });
    set({
      graph: next,
      isDirty: true,
      validationErrors: r.errors,
      validationWarnings: r.warnings,
      issues: r.issues,
    });
  },
  runAutoFixMergeOverlaps: () => {
    const g0 = get().graph;
    if (!g0) return;
    const min = get().editorPreferences.minNodeSep;
    const next = mergeOverlappingNodes(g0, min);
    const p = get().editorPreferences;
    const r = runGraphValidation(next, { shopAccessMaxDist: p.shopAccessMaxDist });
    set({
      graph: next,
      isDirty: true,
      validationErrors: r.errors,
      validationWarnings: r.warnings,
      issues: r.issues,
    });
  },
  setRoute: (a, b) => set({ routeFrom: a, routeTo: b }),
  setRoutePath: (p) => set({ routePath: p }),
  setServerRoutePath: (p) => set({ serverRoutePath: p }),
  setPublishedVersion: (v) => set({ publishedVersion: v }),
  markClean: () => set({ isDirty: false }),
  markDirty: () => set({ isDirty: true }),

  addNodeAt: (x, y) => {
    const g = get().graph;
    if (!g) return;
    const prefs = get().editorPreferences;
    let px = x;
    let py = y;
    if (prefs.gridSnap) {
      const sn = snapToGrid(x, y, prefs.gridSize);
      px = sn.x;
      py = sn.y;
    }
    if (!canPlaceNodeAt(px, py, null, g.nodes, prefs.minNodeSep)) {
      set({
        constraintMessage: `Nodes must be at least ${prefs.minNodeSep} map units apart (or disable overlap checks by lowering separation in code).`,
      });
      return;
    }
    const id = `N-${nanoid(6)}`;
    const n: GraphNode = { id, x: px, y: py, type: "intersection" };
    set({
      graph: buildPayload(g, { nodes: [...g.nodes, n] }),
      isDirty: true,
      selectedNodeId: id,
      selectedShopId: null,
      selectedEdgeKey: null,
      constraintMessage: null,
    });
  },
  moveNode: (id, x, y) => {
    const g = get().graph;
    if (!g) return;
    const prefs = get().editorPreferences;
    let px = x;
    let py = y;
    if (prefs.gridSnap) {
      const sn = snapToGrid(x, y, prefs.gridSize);
      px = sn.x;
      py = sn.y;
    }
    if (!canPlaceNodeAt(px, py, id, g.nodes, prefs.minNodeSep)) {
      return;
    }
    const nodes = g.nodes.map((n) => (n.id === id ? { ...n, x: px, y: py } : n));
    set({ graph: buildPayload(g, { nodes }), isDirty: true, constraintMessage: null });
  },
  removeNode: (id) => {
    const g = get().graph;
    if (!g) return;
    const nodes = g.nodes.filter((n) => n.id !== id);
    const edges = g.edges.filter((e) => e.from !== id && e.to !== id);
    const shops = g.shops
      .filter((s) => s.location_node !== id)
      .map((s) => s);
    set((st) => ({
      graph: buildPayload(g, { nodes, edges, shops }),
      isDirty: true,
      selectedNodeId: st.selectedNodeId === id ? null : st.selectedNodeId,
    }));
  },
  addEdge: (a, b) => {
    if (a === b) {
      set({ constraintMessage: "Cannot create a self-edge." });
      return;
    }
    const g = get().graph;
    if (!g) return;
    if (g.edges.some((e) => edgeKey(e.from, e.to) === edgeKey(a, b))) return;
    const u = g.nodes.find((n) => n.id === a);
    const v = g.nodes.find((n) => n.id === b);
    if (!u || !v) return;
    const w = Math.hypot(u.x - v.x, u.y - v.y);
    const edges: GraphEdge[] = [...g.edges, { from: a, to: b, weight: w }];
    set({
      graph: buildPayload(g, { edges: recomputeAllEdgeWeights(g.nodes, edges) }),
      isDirty: true,
      constraintMessage: null,
    });
  },
  removeEdge: (a, b) => {
    const g = get().graph;
    if (!g) return;
    const k = edgeKey(a, b);
    const edges = g.edges.filter((e) => edgeKey(e.from, e.to) !== k);
    set({ graph: buildPayload(g, { edges }), isDirty: true, selectedEdgeKey: null });
  },
  setEdgeConnect: (a, b) => set({ edgeConnect: { a, b } }),
  addShop: (s) => {
    const g = get().graph;
    if (!g) return;
    set({ graph: buildPayload(g, { shops: [...g.shops, s] }), isDirty: true });
  },
  updateShop: (id, p) => {
    const g = get().graph;
    if (!g) return;
    const shops = g.shops.map((s) => (s.id === id ? { ...s, ...p } : s));
    set({ graph: buildPayload(g, { shops }), isDirty: true });
  },
  removeShop: (id) => {
    const g = get().graph;
    if (!g) return;
    set((st) => ({
      graph: buildPayload(g, { shops: g.shops.filter((s) => s.id !== id) }),
      isDirty: true,
      selectedShopId: st.selectedShopId === id ? null : st.selectedShopId,
    }));
  },
  setShopPolygonPoints: (id, points) => {
    const g = get().graph;
    if (!g) return;
    let shops = g.shops.map((s) => (s.id === id ? setFootprint(s, points) : s));
    const sh = shops.find((x) => x.id === id);
    if (sh && g.nodes.length) {
      const poly = getFootprint(sh);
      if (poly.length) {
        const cx = poly.reduce((a, p) => a + p.x, 0) / poly.length;
        const cy = poly.reduce((a, p) => a + p.y, 0) / poly.length;
        const loc = nearestNodeId(cx, cy, g.nodes);
        if (loc)
          shops = shops.map((s) => (s.id === id ? { ...s, location_node: loc } : s));
      }
    }
    set({ graph: buildPayload(g, { shops }), isDirty: true });
  },
  pushShopDrawPoint: (x, y) => set((s) => ({ shopDrawPoints: [...s.shopDrawPoints, { x, y }] })),
  clearShopDraw: () => set({ shopDrawPoints: [] }),
  finishShopDraw: (name) => {
    const s = get();
    const g = s.graph;
    const pts = s.shopDrawPoints;
    if (!g || pts.length < 3) {
      set({ shopDrawPoints: [] });
      return;
    }
    const nm = (name?.trim() || s.shopNameDraft.trim() || "").trim();
    if (!nm) {
      set({ constraintMessage: "Enter a shop name before finishing the polygon." });
      return;
    }
    const id = `S-${nanoid(6)}`;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const loc = nearestNodeId(cx, cy, g.nodes) ?? g.nodes[0]?.id;
    if (!loc) {
      set({ shopDrawPoints: [] });
      return;
    }
    const base: MapShop = {
      id,
      name: nm,
      location_node: loc,
      category: "",
      tags: [],
      metadata: {},
    };
    const withPoly = setFootprint(base, pts);
    set({
      graph: buildPayload(g, { shops: [...g.shops, withPoly] }),
      shopDrawPoints: [],
      isDirty: true,
      selectedShopId: id,
      selectedNodeId: null,
      selectedEdgeKey: null,
      constraintMessage: null,
    });
  },
}));
