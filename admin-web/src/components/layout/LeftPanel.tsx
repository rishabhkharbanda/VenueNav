import { useEditorStore } from "@/store/editorStore";
import type { RefObject } from "react";
import { ValidationPanel } from "@/components/ui/ValidationPanel";

export function LeftPanel({ canvasWrapRef }: { canvasWrapRef: RefObject<HTMLDivElement | null> }) {
  const graph = useEditorStore((s) => s.graph);
  const selectedShopId = useEditorStore((s) => s.selectedShopId);
  const setSelected = useEditorStore((s) => s.setSelected);

  if (!graph) return <aside className="panel left">Load a map…</aside>;

  return (
    <aside className="panel left">
      <h3>Shops</h3>
      <ul className="list">
        {graph.shops.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={selectedShopId === s.id ? "active" : ""}
              onClick={() => setSelected({ shop: s.id, node: null, edge: null })}
            >
              {s.name || s.id}
            </button>
          </li>
        ))}
      </ul>
      <h3>Nodes ({graph.nodes.length})</h3>
      <ul className="list scroll">
        {graph.nodes.map((n) => (
          <li key={n.id}>
            <code>{n.id}</code>
          </li>
        ))}
      </ul>
      <ValidationPanel canvasWrapRef={canvasWrapRef} />
    </aside>
  );
}
