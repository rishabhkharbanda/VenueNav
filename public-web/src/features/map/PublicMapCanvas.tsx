import { useEffect, useRef, useCallback } from "react";
import { Application, Assets, Container, Graphics, Sprite, FederatedPointerEvent } from "pixi.js";
import { useNavStore } from "@/store/navStore";
import { getFootprint, nearestNodeId } from "@/lib/graphModel";
import { pickShopAt } from "@/lib/hitTest";
import type { MapPayload, MapShop, PublicLiveEdgesResponse } from "@/types/map";

const NODE_R = 4;

type Props = {
  payload: MapPayload | null;
  liveEdges: PublicLiveEdgesResponse | null;
  onSelectShop: (shop: MapShop) => void;
  onMapTapForStart?: (nodeId: string) => void;
};

export function PublicMapCanvas({ payload, liveEdges, onSelectShop, onMapTapForStart }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<{
    world: Container | null;
    gEdges: Graphics | null;
    gShops: Graphics | null;
    gNodes: Graphics | null;
    gRoute: Graphics | null;
  }>({ world: null, gEdges: null, gShops: null, gNodes: null, gRoute: null });
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const appRef = useRef<Application | null>(null);
  const payloadRef = useRef<MapPayload | null>(null);
  const liveRef = useRef<PublicLiveEdgesResponse | null>(null);
  payloadRef.current = payload;
  liveRef.current = liveEdges;

  const redraw = useCallback(() => {
    const L = layersRef.current;
    const world = L.world;
    if (!world || !L.gEdges || !L.gShops || !L.gNodes || !L.gRoute) return;
    const g = payloadRef.current;
    if (!g) return;

    const liveBy = new Map<string, { is_closed: boolean; crowd_factor: number }>();
    const le = liveRef.current;
    if (le) {
      for (const x of le.edges) {
        liveBy.set(x.edge_id, { is_closed: x.is_closed, crowd_factor: x.crowd_factor });
      }
    }

    const st = useNavStore.getState();
    const {
      showGraph,
      selectedShopId,
      searchHighlightIds,
      routeNodes,
      startNodeId,
      destinationNodeId,
    } = st;

    const gEdges = L.gEdges;
    const gShops = L.gShops;
    const gNodes = L.gNodes;
    const gRoute = L.gRoute;
    gEdges.clear();
    if (showGraph) {
      for (const e of g.edges) {
        const a = g.nodes.find((n) => n.id === e.from);
        const b = g.nodes.find((n) => n.id === e.to);
        if (!a || !b) continue;
        gEdges.moveTo(a.x, a.y);
        gEdges.lineTo(b.x, b.y);
        const o = e.edge_id ? liveBy.get(e.edge_id) : undefined;
        let color = 0x334155;
        let w = 1;
        if (o?.is_closed) {
          color = 0xef4444;
          w = 2.4;
        } else if (o && o.crowd_factor > 1.08) {
          color = 0xf97316;
          w = 1.8;
        }
        gEdges.stroke({ width: w, color, alpha: o?.is_closed ? 0.9 : 0.5 });
      }
    }

    gShops.clear();
    for (const s of g.shops) {
      const poly = getFootprint(s);
      if (poly.length < 2) continue;
      gShops.moveTo(poly[0]!.x, poly[0]!.y);
      for (let i = 1; i < poly.length; i++) gShops.lineTo(poly[i]!.x, poly[i]!.y);
      gShops.closePath();
      const isSel = s.id === selectedShopId;
      const isSrch = searchHighlightIds.includes(s.id);
      const fillC = isSel ? 0xf59e0b : isSrch ? 0x22c55e : 0x3b82f6;
      gShops.fill({ color: fillC, alpha: isSel || isSrch ? 0.4 : 0.22 });
      gShops.stroke({ width: isSel ? 2 : 1, color: 0x0f172a, alpha: 0.45 });
    }

    gNodes.clear();
    if (showGraph) {
      for (const n of g.nodes) {
        gNodes.circle(n.x, n.y, NODE_R);
        const isStart = n.id === startNodeId;
        const isEnd = n.id === destinationNodeId;
        gNodes.fill({
          color: isStart ? 0x22c55e : isEnd ? 0xef4444 : 0x94a3b8,
          alpha: 0.9,
        });
      }
    } else {
      if (startNodeId) {
        const sn = g.nodes.find((n) => n.id === startNodeId);
        if (sn) {
          gNodes.circle(sn.x, sn.y, 8);
          gNodes.fill({ color: 0x22c55e, alpha: 0.95 });
        }
      }
      if (destinationNodeId) {
        const en = g.nodes.find((n) => n.id === destinationNodeId);
        if (en) {
          gNodes.circle(en.x, en.y, 8);
          gNodes.fill({ color: 0xef4444, alpha: 0.95 });
        }
      }
    }

    gRoute.clear();
    if (routeNodes && routeNodes.length >= 2) {
      for (let i = 0; i < routeNodes.length - 1; i++) {
        const a = g.nodes.find((n) => n.id === routeNodes[i]!);
        const b = g.nodes.find((n) => n.id === routeNodes[i + 1]!);
        if (!a || !b) continue;
        gRoute.moveTo(a.x, a.y);
        gRoute.lineTo(b.x, b.y);
        gRoute.stroke({ width: 5, color: 0x38bdf8, alpha: 0.9 });
      }
    }

    gEdges.visible = showGraph;
    gNodes.visible = true;
  }, []);

  useEffect(() => {
    return useNavStore.subscribe((st) => {
      const w = layersRef.current.world;
      if (w) {
        w.scale.set(st.world.scale);
        w.position.set(st.world.tx, st.world.ty);
      }
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [payload, liveEdges, redraw]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const app = new Application();
    let dead = false;
    let lastRaster = "";
    (async () => {
      await app.init({
        width: el.clientWidth,
        height: el.clientHeight,
        background: 0x0c1016,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      });
      if (dead) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      el.appendChild(app.canvas);
      const world = new Container();
      world.sortableChildren = true;
      layersRef.current.world = world;
      app.stage.addChild(world);
      const gEdges = new Graphics();
      const gShops = new Graphics();
      const gNodes = new Graphics();
      const gRoute = new Graphics();
      gEdges.zIndex = 1;
      gShops.zIndex = 2;
      gRoute.zIndex = 3;
      gNodes.zIndex = 4;
      world.addChild(gEdges, gShops, gRoute, gNodes);
      layersRef.current = { world, gEdges, gShops, gNodes, gRoute };
      const onResize = () => {
        app.renderer.resize(el.clientWidth, el.clientHeight);
        redraw();
      };
      window.addEventListener("resize", onResize);
      onResize();
      const toLocal = (e: FederatedPointerEvent) => world.toLocal(e.global);

      const tryRaster = async () => {
        const p = payloadRef.current;
        const url = p?.raster_url;
        if (!url || url === lastRaster) return;
        lastRaster = url;
        try {
          const tex = await Assets.load(url);
          if (dead) return;
          const w0 = layersRef.current.world;
          if (!w0) return;
          const sp = new Sprite(tex);
          sp.zIndex = 0;
          const old = w0.children.find((c) => c.zIndex === 0 && c instanceof Sprite);
          if (old) w0.removeChild(old);
          w0.addChildAt(sp, 0);
          if (p?.width && p?.height) {
            sp.width = p.width;
            sp.height = p.height;
          }
        } catch {
          /* CORS or missing */
        }
        redraw();
      };
      void tryRaster();

      app.stage.eventMode = "static";
      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        const p = toLocal(e);
        const g = payloadRef.current;
        if (!g) return;
        const st = useNavStore.getState();
        if (e.button === 1) {
          lastPanRef.current = { x: e.globalX, y: e.globalY };
          return;
        }
        if (st.pickStartOnMap && onMapTapForStart) {
          const nn = nearestNodeId(p.x, p.y, g.nodes);
          if (nn) onMapTapForStart(nn);
          return;
        }
        const sid = pickShopAt(p.x, p.y, g.shops);
        if (sid) {
          const shop = g.shops.find((s) => s.id === sid);
          if (shop) onSelectShop(shop);
          return;
        }
        if (e.button === 0) lastPanRef.current = { x: e.globalX, y: e.globalY };
      });

      app.stage.on("pointermove", (e: FederatedPointerEvent) => {
        if (lastPanRef.current) {
          const st = useNavStore.getState();
          const dx = e.globalX - lastPanRef.current.x;
          const dy = e.globalY - lastPanRef.current.y;
          lastPanRef.current = { x: e.globalX, y: e.globalY };
          st.setWorld({ tx: st.world.tx + dx, ty: st.world.ty + dy });
        }
      });
      const end = () => {
        lastPanRef.current = null;
      };
      app.stage.on("pointerup", end);
      app.stage.on("pointerupoutside", end);

      app.canvas.addEventListener(
        "wheel",
        (ev) => {
          ev.preventDefault();
          const s0 = useNavStore.getState();
          const factor = ev.deltaY > 0 ? 0.92 : 1.08;
          const s = Math.min(6, Math.max(0.15, s0.world.scale * factor));
          useNavStore.getState().setWorld({ scale: s });
        },
        { passive: false }
      );
      redraw();
    })();
    return () => {
      dead = true;
      const a = appRef.current;
      a?.destroy(true);
      appRef.current = null;
    };
  }, [onSelectShop, onMapTapForStart, redraw]);

  return <div ref={divRef} className="map-canvas-host" />;
}
