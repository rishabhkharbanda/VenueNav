import { useEditorStore } from "@/store/editorStore";
import { runGraphValidation } from "@/validation/validateGraph";
import { useSaveGraph, usePublishMap } from "@/hooks/useMapGraphQuery";
import { shortestPath } from "@/lib/astar";
import { getServerRoute } from "@/api/graphApi";

export function EditorToolbar({
  orgId,
  mapId,
}: {
  orgId: string;
  mapId: string;
}) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const graph = useEditorStore((s) => s.graph);
  const issues = useEditorStore((s) => s.issues);
  const revalidateGraph = useEditorStore((s) => s.revalidateGraph);
  const shopNameDraft = useEditorStore((s) => s.shopNameDraft);
  const setShopNameDraft = useEditorStore((s) => s.setShopNameDraft);
  const shopAccessMaxDist = useEditorStore((s) => s.editorPreferences.shopAccessMaxDist);
  const isDirty = useEditorStore((s) => s.isDirty);
  const routeFrom = useEditorStore((s) => s.routeFrom);
  const routeTo = useEditorStore((s) => s.routeTo);
  const setRoutePath = useEditorStore((s) => s.setRoutePath);
  const setServerRoutePath = useEditorStore((s) => s.setServerRoutePath);
  const shopDrawPoints = useEditorStore((s) => s.shopDrawPoints);
  const finishShopDraw = useEditorStore((s) => s.finishShopDraw);
  const clearShopDraw = useEditorStore((s) => s.clearShopDraw);

  const save = useSaveGraph();
  const publish = usePublishMap();

  const runValidate = () => {
    revalidateGraph();
  };

  const onSave = () => {
    if (!graph) return;
    save.mutate({ orgId, mapId, payload: graph });
  };

  const onPublish = async () => {
    if (!graph) return;
    const v = runGraphValidation(graph, { shopAccessMaxDist });
    if (v.errors.length > 0) {
      useEditorStore.getState().setValidationResult(v.errors, v.warnings);
      alert("Fix validation errors before publishing (see left panel).");
      return;
    }
    if (v.warnings.length > 0) {
      if (
        !window.confirm(
          `Publish with ${v.warnings.length} warning(s)? Review the validation list before shipping.`
        )
      ) {
        return;
      }
    }
    try {
      await publish.mutateAsync({ orgId, mapId });
      alert("Published.");
    } catch (e) {
      alert(`Publish failed: ${e}`);
    }
  };

  const onRoutePreview = () => {
    const g = useEditorStore.getState().graph;
    if (!g || !routeFrom || !routeTo) return;
    const r = shortestPath(g.nodes, g.edges, routeFrom, routeTo);
    setRoutePath(r ? r.path : null);
  };

  const onRouteServer = async () => {
    if (!routeFrom || !routeTo) return;
    try {
      const res = await getServerRoute(mapId, routeFrom, routeTo);
      setServerRoutePath(res.nodes);
    } catch {
      setServerRoutePath(null);
      alert("Server route only works after the map is published (uses public API).");
    }
  };

  return (
    <div className="toolbar">
      <span className="toolbar-title">Tools</span>
      {(
        ["select", "addNode", "addEdge", "drawShop", "routeTest"] as const
      ).map((m) => (
        <button
          key={m}
          type="button"
          className={mode === m ? "active" : ""}
          onClick={() => setMode(m)}
        >
          {m === "select"
            ? "Select"
            : m === "addNode"
              ? "Add node"
              : m === "addEdge"
                ? "Add edge"
                : m === "drawShop"
                  ? "Draw shop"
                  : "Route test"}
        </button>
      ))}
      <span className="sep" />
      {mode === "drawShop" && (
        <>
          <label className="inline-shop-name">
            name
            <input
              value={shopNameDraft}
              onChange={(e) => setShopNameDraft(e.target.value)}
              placeholder="Shop name"
            />
          </label>
          <button
            type="button"
            onClick={() => finishShopDraw(shopNameDraft)}
            disabled={shopDrawPoints.length < 3 || !shopNameDraft.trim()}
          >
            Finish polygon
          </button>
          <button type="button" onClick={() => clearShopDraw()}>
            Clear poly
          </button>
        </>
      )}
      {mode === "routeTest" && (
        <>
          <button type="button" onClick={onRoutePreview}>
            Preview path (local)
          </button>
          <button type="button" onClick={() => void onRouteServer()}>
            Fetch path (server)
          </button>
        </>
      )}
      <span className="sep" />
      <button type="button" onClick={runValidate}>
        Validate
      </button>
      <button type="button" onClick={onSave} disabled={!isDirty || save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => void onPublish()} disabled={publish.isPending}>
        {publish.isPending ? "Publish…" : "Publish"}
      </button>
      {issues.length > 0 && (
        <span className="issue-badge">
          {issues.filter((i) => i.severity === "error").length} err /{" "}
          {issues.filter((i) => i.severity === "warning").length} warn
        </span>
      )}
    </div>
  );
}
