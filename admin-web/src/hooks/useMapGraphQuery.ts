import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGraph, putGraph, publishMap } from "@/api/graphApi";
import type { MapPayload } from "@/types/mapGraph";
import { useEditorStore } from "@/store/editorStore";

export function useMapGraphQuery(orgId: string, mapId: string) {
  const hydrateGraph = useEditorStore((s) => s.hydrateGraph);
  const setContext = useEditorStore((s) => s.setContext);
  return useQuery({
    queryKey: ["mapGraph", orgId, mapId, "draft"],
    enabled: Boolean(orgId && mapId),
    queryFn: async () => {
      const data = await getGraph(orgId, mapId, "draft");
      setContext(orgId, mapId, undefined);
      hydrateGraph(data);
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

