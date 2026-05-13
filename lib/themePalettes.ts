export type ThemeId = "aurora" | "ember" | "mono";

const ACCENTS: Record<ThemeId, string[]> = {
  aurora: ["#5ee7ff", "#a78bfa", "#34d399", "#f472b6", "#38bdf8"],
  ember: ["#fb7185", "#fb923c", "#fcd34d", "#f97316", "#fecdd3"],
  mono: ["#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b"],
};

export function randomAccent(theme: ThemeId): string {
  const list = ACCENTS[theme];
  return list[Math.floor(Math.random() * list.length)] ?? "#a5f3fc";
}

export const HUD_THEMES: Record<
  ThemeId,
  { label: string; panel: string; glow: string; accent: string }
> = {
  aurora: {
    label: "Aurora",
    panel: "rgba(12, 20, 40, 0.55)",
    glow: "rgba(94, 231, 255, 0.35)",
    accent: "#5ee7ff",
  },
  ember: {
    label: "Ember",
    panel: "rgba(40, 14, 10, 0.55)",
    glow: "rgba(251, 146, 60, 0.4)",
    accent: "#fb923c",
  },
  mono: {
    label: "Mono",
    panel: "rgba(15, 23, 42, 0.62)",
    glow: "rgba(226, 232, 240, 0.22)",
    accent: "#e2e8f0",
  },
};
