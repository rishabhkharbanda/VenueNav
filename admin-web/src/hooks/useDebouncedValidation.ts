import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { VALIDATION_DEBOUNCE_MS } from "@/validation/constants";

/**
 * Re-runs graph validation after the graph or dirty flag changes (debounced).
 */
export function useDebouncedValidation() {
  const graph = useEditorStore((s) => s.graph);
  const isDirty = useEditorStore((s) => s.isDirty);
  const revalidate = useEditorStore((s) => s.revalidateGraph);

  useEffect(() => {
    if (!graph) return;
    const t = window.setTimeout(() => revalidate(), VALIDATION_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [graph, isDirty, revalidate]);
}
