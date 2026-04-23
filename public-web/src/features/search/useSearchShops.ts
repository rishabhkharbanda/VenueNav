import { useQuery } from "@tanstack/react-query";
import { publicSearch } from "@/api/publicApi";

export function useSearchShops(mapId: string | undefined, q: string) {
  const qTrim = q.trim();
  return useQuery({
    queryKey: ["publicSearch", mapId, qTrim],
    queryFn: () => publicSearch(mapId!, qTrim),
    enabled: Boolean(mapId && qTrim.length >= 1),
    staleTime: 30_000,
  });
}
