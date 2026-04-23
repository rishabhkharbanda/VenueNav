import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/store/editorStore";
import { apiUrl } from "@/api/client";
import { getImportArtifact, presignPdfUpload, startMapProcess, getMapJob } from "@/api/graphApi";

export function ImportFromPdfPanel() {
  const orgId = useEditorStore((s) => s.orgId);
  const mapId = useEditorStore((s) => s.mapId);
  const importOverlay = useEditorStore((s) => s.importOverlay);
  const importVisible = useEditorStore((s) => s.importOverlayVisible);
  const setImportVisible = useEditorStore((s) => s.setImportOverlayVisible);
  const applyImportOverlay = useEditorStore((s) => s.applyImportOverlayToGraph);
  const clearImport = useEditorStore((s) => s.clearImportOverlay);
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPickPdf = (f: File | null) => {
    if (!f || f.type !== "application/pdf" || !orgId || !mapId) {
      setMsg("Select a PDF and open the editor with a valid map.");
      return;
    }
    void (async () => {
      setBusy(true);
      setMsg(null);
      try {
        const { upload_url, asset_id, headers } = await presignPdfUpload(orgId, mapId);
        const putUrl = upload_url.startsWith("http") ? upload_url : apiUrl(upload_url);
        const r = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": headers["Content-Type"] || "application/pdf" },
          body: f,
        });
        if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
        const job = await startMapProcess(orgId, mapId, asset_id);
        setMsg(`Processing (job ${job.id.slice(0, 8)}…) — wait for the worker, then use Refresh.`);
        const jid = job.id;
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const st = await getMapJob(orgId, mapId, jid);
          if (st.status === "awaiting_review" || st.status === "failed" || st.progress >= 0.99) {
            if (st.status === "failed") {
              setMsg(st.error_message || "Process failed");
            } else {
              setMsg("Done — reloaded import overlay.");
            }
            break;
          }
        }
        const imp = await getImportArtifact(orgId, mapId);
        if (imp.artifact?.suggested) {
          const g = useEditorStore.getState().graph;
          if (g) {
            useEditorStore.getState().setImportOverlay({
              ...imp.artifact.suggested,
              map_id: g.map_id,
              map_version_id: g.map_version_id,
              raster_url: g.raster_url ?? null,
            });
          }
        }
        void qc.invalidateQueries({ queryKey: ["mapGraph", orgId, mapId] });
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Import failed");
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="import-panel">
      <h3>PDF import (beta)</h3>
      <p className="small">
        Upload a floor PDF: the worker builds a high-res image, light-area graph, and text
        from the PDF. Shown in cyan; merge into the draft when ready.
      </p>
      <label className="import-file">
        <input
          type="file"
          accept="application/pdf"
          disabled={busy || !orgId || !mapId}
          onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
        />
        {busy ? "Uploading & processing…" : "Choose PDF…"}
      </label>
      {msg && <p className="import-msg small">{msg}</p>}
      {importOverlay && (
        <div className="import-actions">
          <label className="small">
            <input
              type="checkbox"
              checked={importVisible}
              onChange={(e) => setImportVisible(e.target.checked)}
            />
            Show suggested graph
          </label>
          <button
            type="button"
            className="btn tiny"
            onClick={() => {
              applyImportOverlay();
            }}
          >
            Merge into draft
          </button>
          <button type="button" className="btn tiny link" onClick={() => void clearImport()}>
            Clear overlay
          </button>
        </div>
      )}
    </div>
  );
}
