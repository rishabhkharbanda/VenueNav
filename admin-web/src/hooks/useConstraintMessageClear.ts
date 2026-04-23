import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";

/** Clears transient constraint messages after a few seconds */
export function useConstraintMessageClear() {
  const msg = useEditorStore((s) => s.constraintMessage);
  const setMsg = useEditorStore((s) => s.setConstraintMessage);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4500);
    return () => window.clearTimeout(t);
  }, [msg, setMsg]);
}
