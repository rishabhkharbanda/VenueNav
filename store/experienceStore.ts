import { create } from "zustand";
import type { ExtrudeGeometry } from "three";
import type { ThemeId } from "@/lib/themePalettes";
import { randomAccent } from "@/lib/themePalettes";

export type RainItem = {
  id: string;
  geometry: ExtrudeGeometry;
  color: string;
};

export type InputMode = "gesture" | "mouse";

const MAX_RAIN = 200;

type ExperienceState = {
  inputMode: InputMode;
  theme: ThemeId;
  rain: RainItem[];
  setInputMode: (mode: InputMode) => void;
  setTheme: (theme: ThemeId) => void;
  spawnRain: (geometry: ExtrudeGeometry, color?: string) => void;
  clearRain: () => void;
};

function disposeRain(items: RainItem[]) {
  for (const item of items) item.geometry.dispose();
}

export const useExperienceStore = create<ExperienceState>((set, get) => ({
  inputMode: "gesture",
  theme: "aurora",
  rain: [],

  setInputMode: (inputMode) => set({ inputMode }),

  setTheme: (theme) => set({ theme }),

  spawnRain: (geometry, colorOverride) => {
    const color = colorOverride ?? randomAccent(get().theme);
    set((s) => {
      const next: RainItem[] = [
        ...s.rain,
        { id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), geometry, color },
      ];
      while (next.length > MAX_RAIN) {
        const dropped = next.shift();
        if (dropped) dropped.geometry.dispose();
      }
      return { rain: next };
    });
  },

  clearRain: () => {
    const prev = get().rain;
    disposeRain(prev);
    set({ rain: [] });
  },
}));
