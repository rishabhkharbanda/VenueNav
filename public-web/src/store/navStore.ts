import { create } from "zustand";

export interface NavState {
  world: { scale: number; tx: number; ty: number };
  setWorld: (w: Partial<{ scale: number; tx: number; ty: number }>) => void;
  focusMapToPoint: (mapX: number, mapY: number, viewW: number, viewH: number) => void;

  showGraph: boolean;
  setShowGraph: (v: boolean) => void;

  selectedShopId: string | null;
  setSelectedShopId: (id: string | null) => void;

  searchHighlightIds: string[];
  setSearchHighlightIds: (ids: string[]) => void;

  startPreference: "entrance" | "map";
  setStartPreference: (m: "entrance" | "map") => void;
  startNodeId: string | null;
  setStartNodeId: (id: string | null) => void;
  pickStartOnMap: boolean;
  setPickStartOnMap: (v: boolean) => void;

  destinationNodeId: string | null;
  setDestinationNodeId: (id: string | null) => void;

  /** Ordered destination nodes to visit (does not include start) */
  visitStops: string[];
  addVisitStop: (nodeId: string) => void;
  clearVisit: () => void;
  setVisitStops: (ids: string[]) => void;
  resetForNewMap: () => void;

  routeNodes: string[] | null;
  routeTotalCost: number | null;
  setRoute: (nodes: string[] | null, cost: number | null) => void;
  routeError: string | null;
  setRouteError: (e: string | null) => void;
  /** Sets routeError without clearing the current path (e.g. after restoring last known route). */
  setRouteErrorMessage: (e: string | null) => void;
  /** Last successful route for live re-checks (full stop chain). */
  routeSession: {
    stopNodes: string[];
    edgeIds: string[];
    pathSignature: string;
    totalCost: number;
  } | null;
  setRouteSession: (
    s: { stopNodes: string[]; edgeIds: string[]; pathSignature: string; totalCost: number } | null
  ) => void;
  routeRefreshMessage: string | null;
  setRouteRefreshMessage: (m: string | null) => void;
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
  /** Last good route (API or offline) for error fallback */
  lastRouteBackup: {
    stopsKey: string;
    nodes: string[];
    cost: number;
    edgeIds: string[];
  } | null;
  setLastRouteBackup: (
    b: { stopsKey: string; nodes: string[]; cost: number; edgeIds: string[] } | null
  ) => void;
}

function focusImpl(
  get: () => NavState,
  set: (p: Partial<NavState>) => void,
  mapX: number,
  mapY: number,
  viewW: number,
  viewH: number
) {
  const s = get().world.scale;
  set({
    world: {
      ...get().world,
      tx: viewW / 2 - mapX * s,
      ty: viewH / 2 - mapY * s,
    },
  });
}

export const useNavStore = create<NavState>((set, get) => ({
  world: { scale: 1, tx: 0, ty: 0 },
  setWorld: (w) => set((s) => ({ world: { ...s.world, ...w } })),
  focusMapToPoint: (mapX, mapY, viewW, viewH) => focusImpl(get, set, mapX, mapY, viewW, viewH),

  showGraph: false,
  setShowGraph: (v) => set({ showGraph: v }),

  selectedShopId: null,
  setSelectedShopId: (id) => set({ selectedShopId: id }),

  searchHighlightIds: [],
  setSearchHighlightIds: (ids) => set({ searchHighlightIds: ids }),

  startPreference: "entrance",
  setStartPreference: (m) =>
    set({
      startPreference: m,
      pickStartOnMap: m === "map" ? get().pickStartOnMap : false,
      startNodeId: m === "entrance" ? null : get().startNodeId,
    }),
  startNodeId: null,
  setStartNodeId: (id) => set({ startNodeId: id }),
  pickStartOnMap: false,
  setPickStartOnMap: (v) => set({ pickStartOnMap: v, startPreference: v ? "map" : get().startPreference }),

  destinationNodeId: null,
  setDestinationNodeId: (id) => set({ destinationNodeId: id }),

  visitStops: [],
  addVisitStop: (nodeId) =>
    set((s) => {
      if (!nodeId) return s;
      if (s.visitStops[s.visitStops.length - 1] === nodeId) return s;
      return { visitStops: [...s.visitStops, nodeId] };
    }),
  clearVisit: () => set({ visitStops: [] }),
  setVisitStops: (ids) => set({ visitStops: ids }),
  resetForNewMap: () =>
    set({
      world: { scale: 1, tx: 0, ty: 0 },
      selectedShopId: null,
      searchHighlightIds: [],
      startNodeId: null,
      pickStartOnMap: false,
      startPreference: "entrance",
      destinationNodeId: null,
      visitStops: [],
      routeNodes: null,
      routeTotalCost: null,
      routeError: null,
      routeSession: null,
      routeRefreshMessage: null,
      lastRouteBackup: null,
    }),

  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  setIsOnline: (v) => set({ isOnline: v }),
  lastRouteBackup: null,
  setLastRouteBackup: (b) => set({ lastRouteBackup: b }),
  routeNodes: null,
  routeTotalCost: null,
  setRoute: (nodes, cost) =>
    set({ routeNodes: nodes, routeTotalCost: cost, routeError: null, routeRefreshMessage: null }),
  routeError: null,
  setRouteError: (e) =>
    set({
      routeError: e,
      routeNodes: null,
      routeTotalCost: null,
      routeSession: null,
      routeRefreshMessage: null,
    }),
  setRouteErrorMessage: (e) => set({ routeError: e }),
  routeSession: null,
  setRouteSession: (s) => set({ routeSession: s }),
  routeRefreshMessage: null,
  setRouteRefreshMessage: (m) => set({ routeRefreshMessage: m }),
}));

