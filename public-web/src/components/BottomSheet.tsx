import type { MapPayload, MapShop } from "@/types/map";
import { useNavStore } from "@/store/navStore";
import { findEntranceNode } from "@/lib/graphModel";
import { formatDistance, formatDuration, estimateWalkSeconds } from "@/lib/routeFormat";
import { getPublicRoute, postMultiRoute } from "@/api/publicApi";
import { useState } from "react";

type Props = {
  mapId: string;
  payload: MapPayload;
};

function metaLine(shop: MapShop) {
  const m = shop.metadata;
  if (!m || Object.keys(m).length === 0) return null;
  const skip = new Set(["venuenav:footprint"]);
  const rest = Object.entries(m).filter(([k]) => !skip.has(k));
  if (rest.length === 0) return null;
  return (
    <p className="shop-meta small">
      {rest.slice(0, 2).map(([k, v]) => (
        <span key={k}>
          {k}: {String(v)}
        </span>
      ))}
    </p>
  );
}

export function BottomSheet({ mapId, payload }: Props) {
  const ent = findEntranceNode(payload.nodes);
  const selectedId = useNavStore((s) => s.selectedShopId);
  const shop = selectedId ? payload.shops.find((s) => s.id === selectedId) : null;
  const destId = useNavStore((s) => s.destinationNodeId);
  const startPref = useNavStore((s) => s.startPreference);
  const startId = useNavStore((s) => s.startNodeId);
  const pick = useNavStore((s) => s.pickStartOnMap);
  const setPick = useNavStore((s) => s.setPickStartOnMap);
  const setStartPref = useNavStore((s) => s.setStartPreference);
  const visit = useNavStore((s) => s.visitStops);
  const addVisit = useNavStore((s) => s.addVisitStop);
  const clearVisit = useNavStore((s) => s.clearVisit);
  const setRoute = useNavStore((s) => s.setRoute);
  const setErr = useNavStore((s) => s.setRouteError);
  const routeNodes = useNavStore((s) => s.routeNodes);
  const routeCost = useNavStore((s) => s.routeTotalCost);
  const routeError = useNavStore((s) => s.routeError);
  const [loading, setLoading] = useState(false);

  const effectiveStart = (): string | null => {
    if (startPref === "map") {
      if (!startId) return null;
      return startId;
    }
    return ent?.id ?? null;
  };

  const onNavigate = async () => {
    if (startPref === "entrance" && !ent) {
      setErr("This map has no entrance node. Use “Choose on map” and tap a path near you.");
      return;
    }
    const from = effectiveStart();
    if (!from) {
      setErr("Choose a start point. Tap a node on the map, or set an entrance in the map data.");
      return;
    }
    if (!destId) {
      setErr("Select a shop first.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const chain: string[] = visit.length ? [...visit, destId] : [destId];
      const dedup: string[] = [];
      for (const id of chain) {
        if (dedup[dedup.length - 1] !== id) dedup.push(id);
      }
      const fullStops: string[] = [from, ...dedup].filter(
        (id, i, a) => i === 0 || id !== a[i - 1]
      ) as string[];
      if (fullStops.length < 2) {
        setErr("Not enough points for a route");
        return;
      }
      if (fullStops.length === 2) {
        const r = await getPublicRoute(mapId, fullStops[0]!, fullStops[1]!);
        setRoute(r.nodes, r.total_cost);
      } else {
        const r = await postMultiRoute(mapId, fullStops, false);
        setRoute(r.nodes, r.total_cost);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Route failed");
    } finally {
      setLoading(false);
    }
  };

  const unit = payload.unit;
  const sec =
    routeCost != null ? estimateWalkSeconds(routeCost, unit) : null;
  const distText =
    routeCost != null ? formatDistance(routeCost, unit) : "—";
  const timeText = sec != null ? formatDuration(sec) : "—";

  return (
    <div className="bottom-sheet" role="region" aria-label="Map details">
      {!shop && (
        <p className="sheet-hint">Tap a shop on the map or search to begin.</p>
      )}
      {shop && (
        <div className="shop-block">
          <h2 className="shop-name">{shop.name}</h2>
          {shop.category && <p className="shop-cat">{shop.category}</p>}
          {metaLine(shop)}
        </div>
      )}

      <div className="start-block">
        <h3>Start from</h3>
        <div className="start-row">
          <label>
            <input
              type="radio"
              name="start"
              checked={startPref === "entrance" && !pick}
              onChange={() => {
                setStartPref("entrance");
                setPick(false);
              }}
            />
            {ent ? "Entrance" : "Default node"}
            {!ent && (
              <span className="warn"> (no “entrance” — use map or add one in the editor)</span>
            )}
          </label>
        </div>
        <div className="start-row">
          <label>
            <input
              type="radio"
              name="start"
              checked={startPref === "map" || pick}
              onChange={() => {
                setStartPref("map");
                setPick(true);
              }}
            />
            Choose on map
            {startId && <span className="mono"> — {startId}</span>}
          </label>
        </div>
        {pick && (
          <p className="small hint">Tap the map near a path node to set your start.</p>
        )}
      </div>

      {destId && (
        <div className="trip-block">
          <h3>Multi-stop (optional)</h3>
          <p className="small">Add the current shop to a chain, then search for the next.</p>
          <div className="row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (destId) addVisit(destId);
              }}
            >
              Add current shop
            </button>
            {visit.length > 0 && (
              <button type="button" className="btn link" onClick={() => clearVisit()}>
                Clear {visit.length} stop(s)
              </button>
            )}
          </div>
          {visit.length > 0 && (
            <p className="small mono">Before finish: {visit.join(" → ")}</p>
          )}
        </div>
      )}

      <div className="nav-actions">
        <button
          type="button"
          className="btn primary"
          disabled={loading || !destId}
          onClick={() => void onNavigate()}
        >
          {loading ? "Routing…" : "Navigate"}
        </button>
      </div>

      {routeError && <p className="err-msg">{routeError}</p>}

      {routeNodes && routeNodes.length > 0 && !routeError && (
        <div className="route-details">
          <h3>Route</h3>
          <p>
            <strong>{distText}</strong> · {timeText} est.
          </p>
        </div>
      )}
    </div>
  );
}
