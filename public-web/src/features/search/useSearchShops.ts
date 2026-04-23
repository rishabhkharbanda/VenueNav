import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { publicSearch } from "@/api/publicApi";
import type { MapShop, SearchItem, SearchResponse } from "@/types/map";

function filterLocal(shops: MapShop[] | undefined, q: string): SearchResponse {
  const qTrim = q.trim();
  if (!qTrim || !shops?.length) return { items: [] };
  const low = qTrim.toLowerCase();
  const items: SearchItem[] = shops
    .filter(
      (s) =>
        s.name.toLowerCase().includes(low) ||
        (s.category && s.category.toLowerCase().includes(low)) ||
        s.tags.some((t) => t.toLowerCase().includes(low))
    )
    .slice(0, 40)
    .map((s) => ({
      id: s.id,
      name: s.name,
      location_node: s.location_node,
      category: s.category,
      tags: s.tags,
      metadata: s.metadata,
    }));
  return { items };
}

type Opts = { offline: boolean; shops: MapShop[] | undefined };

export function useSearchShops(mapId: string | undefined, q: string, opts?: Opts) {
  const qTrim = q.trim();
  const localData = useMemo(
    () => (opts?.offline ? filterLocal(opts.shops, qTrim) : { items: [] as SearchItem[] }),
    [opts?.offline, opts?.shops, qTrim]
  );

  const r = useQuery({
    queryKey: ["publicSearch", mapId, qTrim],
    queryFn: () => publicSearch(mapId!, qTrim),
    enabled: Boolean(!opts?.offline && mapId && qTrim.length >= 1),
    staleTime: 30_000,
  });

  if (opts?.offline && qTrim.length >= 1) {
    return {
      ...r,
      data: localData,
      isLoading: false,
      isError: false,
      isPending: false,
    };
  }
  return r;
}
