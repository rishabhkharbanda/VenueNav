import { useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { EditorToolbar } from "@/components/layout/EditorToolbar";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { RightPanel } from "@/components/layout/RightPanel";
import { PixiMapCanvas } from "@/components/canvas/PixiMapCanvas";
import { useMapGraphQuery } from "@/hooks/useMapGraphQuery";
import { useDebouncedValidation } from "@/hooks/useDebouncedValidation";
import { useConstraintMessageClear } from "@/hooks/useConstraintMessageClear";
import { MapTooltipOverlay } from "@/components/ui/MapTooltipOverlay";
import { useEditorStore } from "@/store/editorStore";

export function MapEditorPage() {
  const [sp] = useSearchParams();
  const orgId = sp.get("orgId") ?? "";
  const mapId = sp.get("mapId") ?? "";
  const q = useMapGraphQuery(orgId, mapId);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const constraintMessage = useEditorStore((s) => s.constraintMessage);
  useDebouncedValidation();
  useConstraintMessageClear();

  useEffect(() => {
    document.title = `Map editor — ${mapId || "VenueNav"}`;
  }, [mapId]);

  if (!orgId || !mapId) {
    return (
      <div className="app-root">
        <p className="hint">
          Set query params: <code>?orgId=…&amp;mapId=…</code>
        </p>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="app-root">
        <p>Loading graph…</p>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="app-root error">
        <p>Failed to load: {(q.error as Error).message}</p>
        <p className="hint">Ensure the API is running and you are a member of the org.</p>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>VenueNav — Map editor</h1>
        <EditorToolbar orgId={orgId} mapId={mapId} />
      </header>
      {constraintMessage && <div className="constraint-banner">{constraintMessage}</div>}
      <div className="editor-body">
        <LeftPanel canvasWrapRef={canvasWrapRef} />
        <div ref={canvasWrapRef} className="canvas-wrap">
          <PixiMapCanvas />
        </div>
        <MapTooltipOverlay />
        <RightPanel />
      </div>
    </div>
  );
}
