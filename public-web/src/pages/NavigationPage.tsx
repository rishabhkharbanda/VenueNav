import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicMapMeta, getPublicPayload } from "@/api/publicApi";
import { PublicMapCanvas } from "@/features/map/PublicMapCanvas";
import { SearchBar } from "@/features/search/SearchBar";
import { BottomSheet } from "@/components/BottomSheet";
import { useNavStore } from "@/store/navStore";
import { shopCentroid } from "@/lib/graphModel";
import type { MapShop } from "@/types/map";

const PAYLOAD_STALE = 5 * 60 * 1000;

export function NavigationPage() {
  const { eventSlug, mapSlug } = useParams<{ eventSlug: string; mapSlug: string }>();
  const [sp] = useSearchParams();
  const mapIdParam = sp.get("mapId");
  const wrapRef = useRef<HTMLDivElement>(null);
  const reset = useNavStore((s) => s.resetForNewMap);
  const setDest = useNavStore((s) => s.setDestinationNodeId);
  const setSelected = useNavStore((s) => s.setSelectedShopId);
  const focus = useNavStore((s) => s.focusMapToPoint);
  const setStart = useNavStore((s) => s.setStartNodeId);
  const setPick = useNavStore((s) => s.setPickStartOnMap);
  const showGraph = useNavStore((s) => s.showGraph);
  const setShowGraph = useNavStore((s) => s.setShowGraph);

  const metaQ = useQuery({
    queryKey: ["publicMapMeta", eventSlug, mapSlug],
    queryFn: () => getPublicMapMeta(eventSlug!, mapSlug!),
    enabled: Boolean(!mapIdParam && eventSlug && mapSlug),
  });

  const directMeta = mapIdParam
    ? { map_id: mapIdParam, map_version_id: "", raster_url: null as string | null, name: "Map" }
    : null;
  const meta = directMeta ?? metaQ.data;

  const payloadQ = useQuery({
    queryKey: ["publicPayload", meta?.map_id],
    queryFn: () => getPublicPayload(meta!.map_id),
    enabled: Boolean(meta?.map_id),
    staleTime: PAYLOAD_STALE,
  });

  const payload = payloadQ.data ?? null;
  const mapId = meta?.map_id;

  useEffect(() => {
    if (mapId) reset();
  }, [mapId, reset]);

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
          <p>Map not found for this event.</p>
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
        <p>Could not load map data.</p>
      </div>
    );
  }

  return (
    <div className="nav-app">
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
          onSelectShop={onSelectShop}
          onMapTapForStart={onMapTapForStart}
        />
      </div>
      <BottomSheet mapId={mapId} payload={payload} />
    </div>
  );
}
