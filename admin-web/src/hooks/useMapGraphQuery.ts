import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGraph, getMapSummary, getImportArtifact, putGraph, publishMap } from "@/api/graphApi";
import type { MapPayload } from "@/types/mapGraph";
import { useEditorStore } from "@/store/editorStore";

export function useMapGraphQuery(orgId: string, mapId: string) {
  const hydrateGraph = useEditorStore((s) => s.hydrateGraph);
  const setContext = useEditorStore((s) => s.setContext);
  return useQuery({
    queryKey: ["mapGraph", orgId, mapId, "draft"],
    enabled: Boolean(orgId && mapId),
    queryFn: async () => {
      const [summary, data, importRes] = await Promise.all([
        getMapSummary(orgId, mapId),
        getGraph(orgId, mapId, "draft"),
        getImportArtifact(orgId, mapId).catch(() => ({ artifact: null, raster_url: null })),
      ]);
      setContext(orgId, mapId, summary.name);
      useEditorStore.getState().setPublishedVersion(summary.published_version);
      hydrateGraph(data);
      const art = importRes.artifact;
      if (art?.suggested) {
        useEditorStore.getState().setImportOverlay({
          ...art.suggested,
          map_id: data.map_id,
          map_version_id: data.map_version_id,
          raster_url: data.raster_url ?? null,
        });
        useEditorStore.getState().setImportOverlayMeta(art.suggested_annotations ?? null);
      } else {
        useEditorStore.getState().setImportOverlay(null);
        useEditorStore.getState().setImportOverlayMeta(null);
      }
      return data;
    },
  });
}

export function useSaveGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      mapId,
      payload,
    }: {
      orgId: string;
      mapId: string;
      payload: MapPayload;
    }) => {
      await putGraph(orgId, mapId, payload);
    },
    onSuccess: (_, { orgId, mapId }) => {
      void qc.invalidateQueries({ queryKey: ["mapGraph", orgId, mapId] });
    },
  });
}

export function usePublishMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, mapId }: { orgId: string; mapId: string }) => {
      return publishMap(orgId, mapId);
    },
    onSuccess: (ver, { orgId, mapId }) => {
      useEditorStore.getState().setPublishedVersion(ver.version);
      void qc.invalidateQueries({ queryKey: ["mapGraph", orgId, mapId] });
    },
  });
}

