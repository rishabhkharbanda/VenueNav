export const editorModes = [
  "select",
  "addNode",
  "addEdge",
  "drawShop",
  "routeTest",
] as const;

export type EditorMode = (typeof editorModes)[number];

export interface EditorPreferences {
  gridSnap: boolean;
  /** Snap grid step in map units */
  gridSize: number;
  /** Minimum center-to-center distance for new or moved nodes */
  minNodeSep: number;
  /** Passed to the validator (shop centroid vs graph) */
  shopAccessMaxDist: number;
}
