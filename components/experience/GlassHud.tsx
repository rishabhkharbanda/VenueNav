"use client";

import { motion } from "framer-motion";
import type { ThemeId } from "@/lib/themePalettes";
import { HUD_THEMES } from "@/lib/themePalettes";
import type { InputMode } from "@/store/experienceStore";

type Props = {
  inputMode: InputMode;
  theme: ThemeId;
  onInputMode: (mode: InputMode) => void;
  onTheme: (theme: ThemeId) => void;
  onClearScene: () => void;
  gestureUi: { tracking: boolean; drawing: boolean };
  error: string | null;
};

const themes: ThemeId[] = ["aurora", "ember", "mono"];

export function GlassHud({
  inputMode,
  theme,
  onInputMode,
  onTheme,
  onClearScene,
  gestureUi,
  error,
}: Props) {
  const hud = HUD_THEMES[theme];

  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      style={{
        position: "fixed",
        top: 18,
        left: 18,
        right: 18,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "min(520px, 100%)",
          borderRadius: 18,
          padding: "14px 16px",
          background: hud.panel,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: `0 18px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 40px ${hud.glow}`,
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          color: "#e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.14em", opacity: 0.72, textTransform: "uppercase" }}>
              VenueNav / Atelier
            </span>
            <strong style={{ fontSize: 17, fontWeight: 650, letterSpacing: "-0.02em" }}>Rainfall studio</strong>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onClearScene}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#f8fafc",
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset scene
          </motion.button>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 0" }} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.65 }}>Input</span>
            <div
              style={{
                display: "inline-flex",
                padding: 3,
                borderRadius: 999,
                background: "rgba(0,0,0,0.28)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {(["gesture", "mouse"] as const).map((mode) => {
                const active = inputMode === mode;
                return (
                  <motion.button
                    key={mode}
                    type="button"
                    onClick={() => onInputMode(mode)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      padding: "7px 14px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      color: active ? "#0f172a" : "rgba(226,232,240,0.78)",
                      background: active ? "rgba(248,250,252,0.96)" : "transparent",
                      boxShadow: active ? "0 8px 22px rgba(0,0,0,0.35)" : "none",
                      transition: "color 160ms ease, background 160ms ease",
                    }}
                  >
                    {mode === "gesture" ? "Gesture" : "Mouse"}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 160 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span style={{ fontSize: 11, opacity: 0.65 }}>Color theme</span>
            <div style={{ display: "flex", gap: 8 }}>
              {themes.map((t) => {
                const meta = HUD_THEMES[t];
                const on = theme === t;
                return (
                  <motion.button
                    key={t}
                    type="button"
                    onClick={() => onTheme(t)}
                    whileHover={{ scale: 1.06, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    title={meta.label}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: on ? "2px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.2)",
                      background: `radial-gradient(circle at 30% 25%, ${meta.accent}, rgba(15,23,42,0.9))`,
                      boxShadow: on ? `0 0 18px ${meta.glow}` : "0 6px 16px rgba(0,0,0,0.35)",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {inputMode === "gesture" ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              opacity: 0.88,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: gestureUi.tracking ? "#4ade80" : "#64748b",
                boxShadow: gestureUi.tracking ? "0 0 14px rgba(74,222,128,0.85)" : "none",
              }}
            />
            <span>{gestureUi.tracking ? "Hand locked" : "Searching…"}</span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span style={{ color: gestureUi.drawing ? "#5eead4" : "#94a3b8" }}>
              {gestureUi.drawing ? "Drawing" : "Idle"}
            </span>
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ margin: "12px 0 0", fontSize: 12, opacity: 0.82 }}
          >
            Click-drag anywhere to sketch. Each release drops a new mesh into the rain field.
          </motion.p>
        )}

        {error ? (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#fecaca" }}>{error}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
