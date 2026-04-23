import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPublicMapMeta, getPublicPayload } from "@/api/publicApi";
import { useLiveRouteRefresh } from "@/hooks/useLiveRouteRefresh";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { idbInit, getMapMetaByEvent, getMapPayload, putMapMetaKey, putMapPayload } from "@/pwa/idbMapStore";
import { PublicMapCanvas } from "@/features/map/PublicMapCanvas";
import { SearchBar } from "@/features/search/SearchBar";
import { BottomSheet } from "@/components/BottomSheet";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { useNavStore } from "@/store/navStore";
import { shopCentroid } from "@/lib/graphModel";
import type { MapShop } from "@/types/map";

const PAYLOAD_STALE = 5 * 60 * 1000;

export function NavigationPage() {
  const { eventSlug, mapSlug } = useParams<{ eventSlug: string; mapSlug: string }>();
  const [sp] = useSearchParams();
  const mapIdParam = sp.get("mapId");
  const wrapRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const reset = useNavStore((s) => s.resetForNewMap);
  const setDest = useNavStore((s) => s.setDestinationNodeId);
  const setSelected = useNavStore((s) => s.setSelectedShopId);
  const focus = useNavStore((s) => s.focusMapToPoint);
  const setStart = useNavStore((s) => s.setStartNodeId);
  const setPick = useNavStore((s) => s.setPickStartOnMap);
  const showGraph = useNavStore((s) => s.showGraph);
  const setShowGraph = useNavStore((s) => s.setShowGraph);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    void idbInit();
  }, []);

  const metaQ = useQuery({
    queryKey: ["publicMapMeta", eventSlug, mapSlug],
    queryFn: async () => {
      if (!eventSlug || !mapSlug) throw new Error("missing");
      try {
        const m = await getPublicMapMeta(eventSlug, mapSlug);
        await putMapMetaKey(eventSlug, mapSlug, m);
        return m;
      } catch {
        const c = await getMapMetaByEvent(eventSlug, mapSlug);
        if (c) return c;
        throw new Error("Map metadata unavailable offline. Open once while online or use ?mapId=…");
      }
    },
    enabled: Boolean(!mapIdParam && eventSlug && mapSlug),
    staleTime: PAYLOAD_STALE,
  });

  const directMeta = mapIdParam
    ? { map_id: mapIdParam, map_version_id: "", raster_url: null as string | null, name: "Map" }
    : null;
  const meta = directMeta ?? metaQ.data;

  const payloadQ = useQuery({
    queryKey: ["publicPayload", meta?.map_id],
    queryFn: async () => {
      const id = meta!.map_id;
      try {
        const p = await getPublicPayload(id);
        await putMapPayload(id, p);
        return p;
      } catch {
        const c = await getMapPayload(id);
        if (c) return c;
        throw new Error("No cached map. Connect once to download, then offline works.");
      }
    },
    enabled: Boolean(meta?.map_id),
    staleTime: PAYLOAD_STALE,
  });

  const payload = payloadQ.data ?? null;
  const mapId = meta?.map_id;

  const { liveEdges } = useLiveRouteRefresh(mapId, isOnline);

  useEffect(() => {
    if (mapId) reset();
  }, [mapId, reset]);

  useEffect(() => {
    if (isOnline && mapId) {
      void qc.invalidateQueries({ queryKey: ["publicPayload", mapId] });
      void qc.invalidateQueries({ queryKey: ["publicLiveEdges", mapId] });
    }
  }, [isOnline, mapId, qc]);

  const onSelectShop = (s: MapShop) => {
    setSelected(s.id);
    setDest(s.location_node);
    const c = shopCentroid(s);
    const el = wrapRef.current;
    if (c && el) {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) focus(c.x, c.y, w, h);
    }
  };

  const onMapTapForStart = (nodeId: string) => {
    setStart(nodeId);
    setPick(false);
  };

  if (!mapIdParam && eventSlug) {
    if (metaQ.isLoading) {
      return <div className="app-screen">Loading map…</div>;
    }
    if (metaQ.isError) {
      return (
        <div className="app-screen error">
          <p>{String((metaQ.error as Error)?.message ?? "Map not found for this event.")}</p>
        </div>
      );
    }
  }

  if (!mapId) {
    return (
      <div className="app-screen">
        <p>Missing event or map in the URL.</p>
        <p className="small">
          Use <code>/e/event-slug/map-slug</code> or <code>?mapId=…</code>
        </p>
      </div>
    );
  }

  if (payloadQ.isLoading) {
    return <div className="app-screen">Loading floor plan…</div>;
  }
  if (payloadQ.isError || !payload) {
    return (
      <div className="app-screen error">
        <p>{String((payloadQ.error as Error)?.message ?? "Could not load map data.")}</p>
      </div>
    );
  }

  return (
    <div className="nav-app">
      <PwaInstallPrompt />
      <OfflineBanner />
      <header className="nav-top">
        <h1 className="nav-title">{meta?.name ?? "Venue map"}</h1>
        <label className="graph-toggle">
          <input
            type="checkbox"
            checked={showGraph}
            onChange={(e) => setShowGraph(e.target.checked)}
          />
          Graph
        </label>
      </header>
      <SearchBar mapId={mapId} payload={payload} canvasWrapRef={wrapRef} />
      <div ref={wrapRef} className="map-stage">
        <PublicMapCanvas
          key={payload.map_id + payload.map_version_id}
          payload={payload}
          liveEdges={!isOnline ? null : liveEdges}
          onSelectShop={onSelectShop}
          onMapTapForStart={onMapTapForStart}
        />
      </div>
      <BottomSheet mapId={mapId} payload={payload} isOnline={isOnline} />
    </div>
  );
}
