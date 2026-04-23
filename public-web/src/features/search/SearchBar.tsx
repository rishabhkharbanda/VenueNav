import { useState, type RefObject } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchShops } from "@/features/search/useSearchShops";
import { useNavStore } from "@/store/navStore";
import { shopCentroid } from "@/lib/graphModel";
import type { MapPayload, SearchItem } from "@/types/map";

type Props = {
  mapId: string;
  payload: MapPayload | null;
  canvasWrapRef: RefObject<HTMLDivElement | null>;
};

export function SearchBar({ mapId, payload, canvasWrapRef }: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const q = useDebounce(raw, 200);
  const { data, isLoading, isError } = useSearchShops(mapId, q);
  const setHighlight = useNavStore((s) => s.setSearchHighlightIds);
  const focus = useNavStore((s) => s.focusMapToPoint);
  const setSelected = useNavStore((s) => s.setSelectedShopId);
  const setDest = useNavStore((s) => s.setDestinationNodeId);
  const setShopSelect = (item: SearchItem) => {
    if (!payload) return;
    const shop = payload.shops.find((s) => s.id === item.id) ?? {
      id: item.id,
      name: item.name,
      location_node: item.location_node,
      category: item.category,
      tags: item.tags,
      metadata: item.metadata,
    };
    setSelected(shop.id);
    setDest(shop.location_node);
    setHighlight([shop.id]);
    setOpen(false);
    setRaw(shop.name);
    const c = shopCentroid(shop as import("@/types/map").MapShop);
    const el = canvasWrapRef.current;
    if (c && el) {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) focus(c.x, c.y, w, h);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="search-bar-wrap">
      <div className="search-bar">
        <span className="search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
            if (e.target.value.length < 1) {
              setHighlight([]);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 200)}
          placeholder="Search shops…"
          aria-label="Search shops"
        />
      </div>
      {open && raw.trim().length > 0 && (
        <ul className="search-results" role="listbox">
          {isLoading && <li className="search-meta">Searching…</li>}
          {isError && <li className="search-err">Search failed</li>}
          {!isLoading && !isError && items.length === 0 && (
            <li className="search-meta">No results</li>
          )}
          {items.map((item) => (
            <li key={item.id} role="option">
              <button
                type="button"
                className="search-hit"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShopSelect(item)}
              >
                <span className="hit-name">{item.name}</span>
                {item.category && <span className="hit-cat">{item.category}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
