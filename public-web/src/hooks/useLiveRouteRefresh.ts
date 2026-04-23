import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { getPublicRoute, postMultiRoute, getPublicLiveEdges } from "@/api/publicApi";
import { useNavStore } from "@/store/navStore";

const POLL_MS = 15_000;
const COST_REL_EPS = 0.08;

export function useLiveRouteRefresh(mapId: string | undefined, isOnline: boolean) {
  const routeSession = useNavStore((s) => s.routeSession);
  const setRoute = useNavStore((s) => s.setRoute);
  const setRouteSession = useNavStore((s) => s.setRouteSession);
  const setMessage = useNavStore((s) => s.setRouteRefreshMessage);
  const setErr = useNavStore((s) => s.setRouteError);

  const lastEpochRef = useRef<number | null>(null);
  const closedHandledKeyRef = useRef<string | null>(null);

  const routeSessionPath = routeSession?.pathSignature;

  const { data: live } = useQuery({
    queryKey: ["publicLiveEdges", mapId],
    queryFn: () => getPublicLiveEdges(mapId!),
    enabled: Boolean(mapId) && isOnline,
    refetchInterval: mapId && isOnline ? POLL_MS : false,
  });

  const refetchRoute = useCallback(
    async (reason: "blocked" | "congestion") => {
      if (!mapId) return;
      const rs = useNavStore.getState().routeSession;
      if (!rs) return;
      const stops = rs.stopNodes;
      if (stops.length < 2) return;
      try {
        let nodes: string[];
        let cost: number;
        let edgeIds: string[];
        if (stops.length === 2) {
          const r = await getPublicRoute(mapId, stops[0]!, stops[1]!);
          nodes = r.nodes;
          cost = r.total_cost;
          edgeIds = r.edge_ids;
        } else {
          const r = await postMultiRoute(mapId, stops, false);
          nodes = r.nodes;
          cost = r.total_cost;
          edgeIds = r.edge_ids;
        }
        const sig = nodes.join(",");
        setRoute(nodes, cost);
        setRouteSession({ stopNodes: stops, edgeIds, pathSignature: sig, totalCost: cost });
        if (reason === "blocked") {
          setMessage("Route updated: a segment was closed. Showing a new path.");
        } else {
          setMessage("Route updated due to congestion or changing conditions.");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Route no longer available");
      }
    },
    [mapId, setRoute, setRouteSession, setMessage, setErr]
  );

  // Closed edge on current path: refetch at most once per (epoch × path) until the path changes.
  useEffect(() => {
    if (!live || !mapId || !routeSession) return;
    const byId = new Map(live.edges.map((e) => [e.edge_id, e]));
    const pathBlocked = routeSession.edgeIds.some((id) => byId.get(id)?.is_closed);
    if (!pathBlocked) {
      return;
    }
    const hkey = `${live.live_epoch}:${routeSessionPath}`;
    if (closedHandledKeyRef.current === hkey) return;
    closedHandledKeyRef.current = hkey;
    void refetchRoute("blocked");
    lastEpochRef.current = live.live_epoch;
  }, [live, mapId, routeSession, routeSessionPath, refetchRoute]);

  // Live epoch bump: recompute; if path or cost shifts materially, notify.
  useEffect(() => {
    if (!live || !mapId || !routeSession) return;

    const byId = new Map(live.edges.map((e) => [e.edge_id, e]));
    if (routeSession.edgeIds.some((id) => byId.get(id)?.is_closed)) {
      return;
    }

    if (lastEpochRef.current === null) {
      lastEpochRef.current = live.live_epoch;
      return;
    }
    if (live.live_epoch === lastEpochRef.current) {
      return;
    }
    lastEpochRef.current = live.live_epoch;

    const stops = routeSession.stopNodes;
    if (stops.length < 2) return;

    void (async () => {
      const rs = useNavStore.getState().routeSession;
      if (!rs || rs.pathSignature !== routeSessionPath) return;

      try {
        let nodes: string[];
        let cost: number;
        let edgeIds: string[];
        if (stops.length === 2) {
          const r = await getPublicRoute(mapId, stops[0]!, stops[1]!);
          nodes = r.nodes;
          cost = r.total_cost;
          edgeIds = r.edge_ids;
        } else {
          const r = await postMultiRoute(mapId, stops, false);
          nodes = r.nodes;
          cost = r.total_cost;
          edgeIds = r.edge_ids;
        }
        const sig = nodes.join(",");
        const pathChanged = sig !== rs.pathSignature;
        const rel = rs.totalCost > 0 ? Math.abs(cost - rs.totalCost) / rs.totalCost : 0;
        if (pathChanged || rel > COST_REL_EPS) {
          setRoute(nodes, cost);
          setRouteSession({ stopNodes: stops, edgeIds, pathSignature: sig, totalCost: cost });
          setMessage("Route updated due to congestion or changing conditions.");
        }
      } catch {
        /* ignore */
      }
    })();
  }, [live, mapId, routeSession, routeSessionPath, setRoute, setRouteSession, setMessage]);

  useEffect(() => {
    lastEpochRef.current = null;
    closedHandledKeyRef.current = null;
  }, [routeSessionPath, mapId]);

  return { liveEdges: live ?? null };
}
