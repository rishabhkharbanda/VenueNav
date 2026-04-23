import { useEditorStore } from "@/store/editorStore";

export function MapTooltipOverlay() {
  const t = useEditorStore((s) => s.mapTooltip);
  if (!t) return null;
  return (
    <div
      className="map-floating-tooltip"
      style={{ left: t.clientX + 12, top: t.clientY + 12 }}
      role="status"
    >
      {t.text}
    </div>
  );
}
