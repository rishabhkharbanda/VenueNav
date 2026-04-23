import { useEffect, useRef, useCallback } from "react";
import { Application, Assets, Container, Graphics, Sprite, FederatedPointerEvent } from "pixi.js";
import { useEditorStore } from "@/store/editorStore";
import { getFootprint, makeEdgeId } from "@/lib/graphModel";
import { buildEntityHighlights, type HighlightLevel } from "@/lib/issueHighlights";

const NODE_R = 6;
const HIT = 14;

export function PixiMapCanvas() {
  const divRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<{
    world: Container | null;
    gEdges: Graphics | null;
    gShops: Graphics | null;
    gVal: Graphics | null;
    gNodes: Graphics | null;
    gRoute: Graphics | null;
    gDraw: Graphics | null;
  }>({ world: null, gEdges: null, gShops: null, gVal: null, gNodes: null, gRoute: null, gDraw: null });
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const dragNodeRef = useRef<string | null>(null);
  const appRef = useRef<Application | null>(null);

  const redraw = useCallback(() => {
    const L = layersRef.current;
    const world = L.world;
    if (!world || !L.gEdges || !L.gShops || !L.gVal || !L.gNodes || !L.gRoute || !L.gDraw) return;
    const g = useEditorStore.getState().graph;
    if (!g) return;

    const gEdges = L.gEdges;
    const gShops = L.gShops;
    const gVal = L.gVal;
    const gNodes = L.gNodes;
    const gRoute = L.gRoute;
    const gDraw = L.gDraw;

    const st = useEditorStore.getState();
    const {
      selectedNodeId,
      selectedEdgeKey,
      selectedShopId,
      routePath,
      serverRoutePath,
      mode,
      shopDrawPoints,
      validationErrors,
      validationWarnings,
    } = st;
    const vIssues = [...validationErrors, ...validationWarnings];
    const nodeIdSet = new Set(g.nodes.map((n) => n.id));
    const shopIdSet = new Set(g.shops.map((s) => s.id));
    const { nodeSeverity, edgeSeverity, shopSeverity } = buildEntityHighlights(
      vIssues,
      nodeIdSet,
      shopIdSet
    );
    const sevColor = (sev: HighlightLevel) => (sev === "error" ? 0xef4444 : sev === "warning" ? 0xca8a04 : null);

    gEdges.clear();
    for (const e of g.edges) {
      const a = g.nodes.find((n) => n.id === e.from);
      const b = g.nodes.find((n) => n.id === e.to);
      if (!a || !b) continue;
      gEdges.moveTo(a.x, a.y);
      gEdges.lineTo(b.x, b.y);
      const k = [e.from, e.to].sort().join("::");
      gEdges.stroke({ width: selectedEdgeKey === k ? 3 : 1.2, color: selectedEdgeKey === k ? 0x5eead4 : 0x4b5563, alpha: 0.9 });
    }

    gShops.clear();
    for (const s of g.shops) {
      const poly = getFootprint(s);
      if (poly.length < 2) continue;
      gShops.moveTo(poly[0]!.x, poly[0]!.y);
      for (let i = 1; i < poly.length; i++) gShops.lineTo(poly[i]!.x, poly[i]!.y);
      gShops.closePath();
      gShops.fill({ color: s.id === selectedShopId ? 0xfbbf24 : 0x3b82f6, alpha: 0.25 });
      gShops.stroke({ width: 1, color: 0x1e3a5f, alpha: 0.5 });
    }

    gVal.clear();
    for (const s of g.shops) {
      const ss = shopSeverity.get(s.id);
      const c = sevColor(ss ?? null);
      if (c == null) continue;
      const poly = getFootprint(s);
      if (poly.length < 2) continue;
      gVal.moveTo(poly[0]!.x, poly[0]!.y);
      for (let i = 1; i < poly.length; i++) gVal.lineTo(poly[i]!.x, poly[i]!.y);
      gVal.closePath();
      gVal.stroke({ width: 3, color: c, alpha: 0.95 });
    }
    for (const e of g.edges) {
      const k = makeEdgeId(e.from, e.to);
      const ss = edgeSeverity.get(k);
      const c = sevColor(ss ?? null);
      if (c == null) continue;
      const a = g.nodes.find((n) => n.id === e.from);
      const b = g.nodes.find((n) => n.id === e.to);
      if (!a || !b) continue;
      gVal.moveTo(a.x, a.y);
      gVal.lineTo(b.x, b.y);
      gVal.stroke({ width: 3.5, color: c, alpha: 0.95 });
    }
    for (const n of g.nodes) {
      const ns = nodeSeverity.get(n.id);
      const c = sevColor(ns ?? null);
      if (c == null) continue;
      gVal.circle(n.x, n.y, NODE_R + 4);
      gVal.stroke({ width: 2, color: c, alpha: 0.95 });
    }

    gNodes.clear();
    for (const n of g.nodes) {
      gNodes.circle(n.x, n.y, NODE_R);
      gNodes.fill({ color: n.id === selectedNodeId ? 0xf59e0b : 0xe5e7eb, alpha: 0.95 });
    }

    gRoute.clear();
    const drawSeg = (path: string[] | null, color: number) => {
      if (!path || path.length < 2) return;
      for (let i = 0; i < path.length - 1; i++) {
        const a = g.nodes.find((n) => n.id === path[i]!);
        const b = g.nodes.find((n) => n.id === path[i + 1]!);
        if (!a || !b) continue;
        gRoute.moveTo(a.x, a.y);
        gRoute.lineTo(b.x, b.y);
        gRoute.stroke({ width: 4, color, alpha: 0.8 });
      }
    };
    drawSeg(serverRoutePath, 0x22c55e);
    drawSeg(routePath, 0xec4899);

    gDraw.clear();
    if (mode === "drawShop" && shopDrawPoints.length) {
      gDraw.moveTo(shopDrawPoints[0]!.x, shopDrawPoints[0]!.y);
      for (let i = 1; i < shopDrawPoints.length; i++) {
        gDraw.lineTo(shopDrawPoints[i]!.x, shopDrawPoints[i]!.y);
      }
      gDraw.stroke({ width: 1.5, color: 0x93c5fd, alpha: 0.9 });
    }
  }, []);

  useEffect(() => {
    return useEditorStore.subscribe(() => {
      const st = useEditorStore.getState();
      const w = layersRef.current.world;
      if (w) {
        w.scale.set(st.world.scale);
        w.position.set(st.world.tx, st.world.ty);
      }
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const app = new Application();
    let dead = false;
    let unsubRaster: (() => void) | null = null;
    let lastRaster = "";

    (async () => {
      await app.init({
        width: el.clientWidth,
        height: el.clientHeight,
        background: 0x0f1114,
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
      const gVal = new Graphics();
      const gNodes = new Graphics();
      const gRoute = new Graphics();
      const gDraw = new Graphics();
      gEdges.zIndex = 1;
      gShops.zIndex = 2;
      gVal.zIndex = 3;
      gNodes.zIndex = 4;
      gRoute.zIndex = 5;
      gDraw.zIndex = 6;
      world.addChild(gEdges, gShops, gVal, gNodes, gRoute, gDraw);
      layersRef.current = { world, gEdges, gShops, gVal, gNodes, gRoute, gDraw };

      const onResize = () => {
        app.renderer.resize(el.clientWidth, el.clientHeight);
        redraw();
      };
      window.addEventListener("resize", onResize);
      onResize();

      const toLocal = (e: FederatedPointerEvent) => world.toLocal(e.global);

      const pickNode = (x: number, y: number) => {
        const g = useEditorStore.getState().graph;
        if (!g) return null;
        for (const n of g.nodes) {
          if (Math.hypot(n.x - x, n.y - y) <= HIT) return n.id;
        }
        return null;
      };

      const pickEdgeKey = (x: number, y: number) => {
        const g = useEditorStore.getState().graph;
        if (!g) return null;
        for (const e of g.edges) {
          const a = g.nodes.find((n) => n.id === e.from);
          const b = g.nodes.find((n) => n.id === e.to);
          if (!a || !b) continue;
          if (distPointSeg(x, y, a.x, a.y, b.x, b.y) < 8) return [e.from, e.to].sort().join("::");
        }
        return null;
      };

      const pickShopByCentroid = (x: number, y: number) => {
        const g0 = useEditorStore.getState().graph;
        if (!g0) return null;
        let best: { id: string; d2: number } | null = null;
        for (const s of g0.shops) {
          const poly = getFootprint(s);
          if (poly.length < 1) continue;
          let cx = 0;
          let cy = 0;
          for (const p of poly) {
            cx += p.x;
            cy += p.y;
          }
          cx /= poly.length;
          cy /= poly.length;
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d2 < 45 * 45 && (!best || d2 < best.d2)) best = { id: s.id, d2 };
        }
        return best?.id ?? null;
      };

      const tooltipForMapPoint = (wx: number, wy: number, ex: number, ey: number) => {
        const s0 = useEditorStore.getState();
        const g0 = s0.graph;
        if (!g0) {
          s0.setMapTooltip(null);
          return;
        }
        const all = [...s0.validationErrors, ...s0.validationWarnings];
        if (all.length === 0) {
          s0.setMapTooltip(null);
          return;
        }
        const n0 = pickNode(wx, wy);
        if (n0) {
          const hit = all.find((i) => i.relatedIds?.includes(n0));
          if (hit) {
            s0.setMapTooltip({ text: `${hit.code}: ${hit.message}`, clientX: ex, clientY: ey });
            return;
          }
        }
        const sId = pickShopByCentroid(wx, wy);
        if (sId) {
          const hit = all.find((i) => i.relatedIds?.includes(sId));
          if (hit) {
            s0.setMapTooltip({ text: `${hit.code}: ${hit.message}`, clientX: ex, clientY: ey });
            return;
          }
        }
        s0.setMapTooltip(null);
      };

      app.stage.eventMode = "static";

      app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
        const p = toLocal(e);
        const st = useEditorStore.getState();
        st.setCursor({ x: p.x, y: p.y });
        if (e.button === 1) {
          lastPanRef.current = { x: e.globalX, y: e.globalY };
          return;
        }
        if (st.mode === "addNode") {
          st.addNodeAt(p.x, p.y);
          return;
        }
        if (st.mode === "addEdge") {
          const nId = pickNode(p.x, p.y);
          if (nId) {
            if (!st.edgeConnect.a) st.setEdgeConnect(nId, null);
            else {
              st.addEdge(st.edgeConnect.a, nId);
              st.setEdgeConnect(null, null);
            }
          }
          return;
        }
        if (st.mode === "drawShop") {
          st.pushShopDrawPoint(p.x, p.y);
          return;
        }
        if (st.mode === "routeTest") {
          const nId = pickNode(p.x, p.y);
          if (nId) {
            if (!st.routeFrom) st.setRoute(nId, st.routeTo);
            else st.setRoute(st.routeFrom, nId);
          }
          return;
        }
        const nId = pickNode(p.x, p.y);
        if (nId) {
          st.setSelected({ node: nId, edge: null, shop: null });
          dragNodeRef.current = nId;
          return;
        }
        const ek = pickEdgeKey(p.x, p.y);
        if (ek) st.setSelected({ node: null, edge: ek, shop: null });
        else st.setSelected({ node: null, edge: null, shop: null });
        if (e.button === 0) lastPanRef.current = { x: e.globalX, y: e.globalY };
      });

      app.stage.on("pointermove", (e: FederatedPointerEvent) => {
        const p = toLocal(e);
        useEditorStore.getState().setCursor({ x: p.x, y: p.y });
        const st = useEditorStore.getState();
        const dragId = dragNodeRef.current;
        if (dragId && st.mode === "select") {
          st.moveNode(dragId, p.x, p.y);
        } else if (lastPanRef.current) {
          const dx = e.globalX - lastPanRef.current.x;
          const dy = e.globalY - lastPanRef.current.y;
          lastPanRef.current = { x: e.globalX, y: e.globalY };
          st.setWorld({ tx: st.world.tx + dx, ty: st.world.ty + dy });
        }
        const ne = e.nativeEvent as MouseEvent;
        tooltipForMapPoint(p.x, p.y, ne.clientX, ne.clientY);
      });

      const end = () => {
        dragNodeRef.current = null;
        lastPanRef.current = null;
      };
      app.stage.on("pointerup", end);
      app.stage.on("pointerupoutside", end);
      app.stage.on("pointerleave", () => {
        useEditorStore.getState().setMapTooltip(null);
      });

      app.canvas.addEventListener(
        "wheel",
        (ev) => {
          ev.preventDefault();
          const s0 = useEditorStore.getState();
          const factor = ev.deltaY > 0 ? 0.92 : 1.08;
          const s = Math.min(8, Math.max(0.08, s0.world.scale * factor));
          useEditorStore.getState().setWorld({ scale: s });
        },
        { passive: false }
      );

      const tryRaster = async () => {
        const url = useEditorStore.getState().graph?.raster_url;
        if (!url || url === lastRaster) return;
        lastRaster = url;
        try {
          const tex = await Assets.load(url);
          if (dead) return;
          const w = layersRef.current.world;
          if (!w) return;
          const g = useEditorStore.getState().graph;
          const sp = new Sprite(tex);
          sp.zIndex = 0;
          const old = w.children.find((c) => c.zIndex === 0 && c instanceof Sprite);
          if (old) w.removeChild(old);
          w.addChildAt(sp, 0);
          if (g?.width && g?.height) {
            sp.width = g.width;
            sp.height = g.height;
          }
        } catch {
          /* CORS / missing */
        }
        redraw();
      };
      let rlast = "";
      unsubRaster = useEditorStore.subscribe((state) => {
        const u = state.graph?.raster_url ?? "";
        if (u !== rlast) {
          rlast = u;
          void tryRaster();
        }
      });
      void tryRaster();
      redraw();

      const cleanup = () => {
        window.removeEventListener("resize", onResize);
        unsubRaster?.();
      };
      (app as { _pixiCleanup?: () => void })._pixiCleanup = cleanup;
    })();

    return () => {
      dead = true;
      const a = appRef.current;
      (a as { _pixiCleanup?: () => void } | null)?._pixiCleanup?.();
      a?.destroy(true);
      appRef.current = null;
    };
  }, [redraw]);

  return <div ref={divRef} className="map-canvas-host" />;
}

function distPointSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
