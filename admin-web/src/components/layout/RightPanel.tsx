import { useEditorStore } from "@/store/editorStore";
import { DEFAULT_SHOP_ACCESS_MAX_DIST } from "@/validation/constants";
import { useCallback } from "react";

export function RightPanel() {
  const graph = useEditorStore((s) => s.graph);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectedShopId = useEditorStore((s) => s.selectedShopId);
  const selectedEdgeKey = useEditorStore((s) => s.selectedEdgeKey);
  const updateShop = useEditorStore((s) => s.updateShop);
  const removeNode = useEditorStore((s) => s.removeNode);
  const removeEdge = useEditorStore((s) => s.removeEdge);
  const removeShop = useEditorStore((s) => s.removeShop);
  const updateNode = useEditorStore((s) => s.updateNode);
  const cursor = useEditorStore((s) => s.cursor);
  const routeFrom = useEditorStore((s) => s.routeFrom);
  const routeTo = useEditorStore((s) => s.routeTo);
  const world = useEditorStore((s) => s.world);
  const editorPreferences = useEditorStore((s) => s.editorPreferences);
  const setEditorPreferences = useEditorStore((s) => s.setEditorPreferences);

  const node = graph?.nodes.find((n) => n.id === selectedNodeId);
  const shop = graph?.shops.find((s) => s.id === selectedShopId);

  const onShopField = useCallback(
    (field: "name" | "category", v: string) => {
      if (!shop) return;
      updateShop(shop.id, { [field]: v });
    },
    [shop, updateShop]
  );

  if (!graph) return <aside className="panel right" />;

  return (
    <aside className="panel right">
      <h3>Editor</h3>
      <label className="check-row">
        <input
          type="checkbox"
          checked={editorPreferences.gridSnap}
          onChange={(e) => setEditorPreferences({ gridSnap: e.target.checked })}
        />
        snap to grid ({editorPreferences.gridSize}u)
      </label>
      <label className="check-row">
        shop access distance (validation, map units)
        <input
          type="number"
          min={50}
          step={10}
          value={editorPreferences.shopAccessMaxDist}
          onChange={(e) =>
            setEditorPreferences({ shopAccessMaxDist: Number(e.target.value) || DEFAULT_SHOP_ACCESS_MAX_DIST })
          }
        />
      </label>
      <h3>Pointer</h3>
      <p className="mono">
        map: ({cursor.x.toFixed(1)}, {cursor.y.toFixed(1)}) scale {world.scale.toFixed(2)}
      </p>
      <h3>Route test</h3>
      <p className="mono">
        from: {routeFrom ?? "—"} → to: {routeTo ?? "—"}
      </p>

      {selectedEdgeKey && (
        <section>
          <h3>Edge</h3>
          <p className="mono">{selectedEdgeKey}</p>
          <button
            type="button"
            onClick={() => {
              const [a, b] = selectedEdgeKey.split("::");
              removeEdge(a!, b!);
            }}
          >
            Delete edge
          </button>
        </section>
      )}

      {node && (
        <section>
          <h3>Node</h3>
          <label>
            id
            <input value={node.id} readOnly />
          </label>
          <label>
            type
            <select
              value={node.type}
              onChange={(e) => {
                const t = e.target.value as typeof node.type;
                updateNode(node.id, { type: t });
              }}
            >
              <option value="intersection">intersection</option>
              <option value="entrance">entrance</option>
              <option value="exit">exit</option>
              <option value="shop_entry">shop_entry</option>
              <option value="generic">generic</option>
            </select>
          </label>
          <label>
            label
            <input
              value={node.label ?? ""}
              onChange={(e) => {
                updateNode(node.id, { label: e.target.value || null });
              }}
            />
          </label>
          <button type="button" onClick={() => removeNode(node.id)}>
            Delete node
          </button>
        </section>
      )}

      {shop && (
        <section>
          <h3>Shop</h3>
          <label>
            name
            <input value={shop.name} onChange={(e) => onShopField("name", e.target.value)} />
          </label>
          <label>
            category
            <input value={shop.category ?? ""} onChange={(e) => onShopField("category", e.target.value)} />
          </label>
          <label>
            location_node
            <input value={shop.location_node} readOnly />
          </label>
          <button type="button" onClick={() => removeShop(shop.id)}>
            Delete shop
          </button>
        </section>
      )}
    </aside>
  );
}
