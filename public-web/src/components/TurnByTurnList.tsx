import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineStep } from "@/navigation/directionEngine";

type Props = {
  steps: EngineStep[];
  pathSignature: string | null;
};

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (navigator.language as string) || "en-US";
  window.speechSynthesis.speak(u);
}

export function TurnByTurnList({ steps, pathSignature }: Props) {
  const [current, setCurrent] = useState(0);
  const itemRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());

  useEffect(() => {
    setCurrent(0);
  }, [pathSignature]);

  const max = steps.length - 1;
  const canPrev = current > 0;
  const canNext = current < max;

  const scrollToActive = useCallback((idx: number) => {
    const el = itemRefs.current.get(idx);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToActive(current);
  }, [current, scrollToActive, steps.length]);

  if (steps.length === 0) return null;

  const activeLine = steps[current]?.line ?? "";

  const tts = typeof globalThis !== "undefined" && "speechSynthesis" in globalThis;

  return (
    <div className="turn-by-turn" role="region" aria-label="Turn-by-turn directions">
      <h3 className="tt-title">Step-by-step</h3>
      <p className="tt-current-label small">Current step is highlighted. Use Next/Back to follow the route.</p>
      <ol className="tt-list" start={1}>
        {steps.map((s, i) => (
          <li
            key={`${i}-${s.type}`}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
            className={`tt-step${i === current ? " tt-step--active" : ""}`}
            aria-current={i === current ? "step" : undefined}
          >
            {s.line}
          </li>
        ))}
      </ol>
      <div className="tt-controls">
        <div className="tt-nav">
          <button
            type="button"
            className="btn secondary small"
            disabled={!canPrev}
            onClick={() => {
              setCurrent((c) => Math.max(0, c - 1));
            }}
          >
            Back
          </button>
          <button
            type="button"
            className="btn primary small"
            disabled={!canNext}
            onClick={() => {
              setCurrent((c) => Math.min(max, c + 1));
            }}
          >
            Next
          </button>
        </div>
        {tts && (
          <button
            type="button"
            className="btn link small"
            onClick={() => speakText(activeLine)}
          >
            Read aloud
          </button>
        )}
      </div>
    </div>
  );
}
