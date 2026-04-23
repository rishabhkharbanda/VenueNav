import type { RefObject } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ValidationIssue } from "@/validation/types";

export function ValidationPanel({ canvasWrapRef }: { canvasWrapRef: RefObject<HTMLDivElement | null> }) {
  const errors = useEditorStore((s) => s.validationErrors);
  const warnings = useEditorStore((s) => s.validationWarnings);
  const selectedId = useEditorStore((s) => s.selectedValidationIssueId);
  const setSel = useEditorStore((s) => s.setSelectedValidationIssueId);
  const focusMap = useEditorStore((s) => s.focusMapToPoint);
  const connect = useEditorStore((s) => s.runAutoFixConnectComponents);
  const attach = useEditorStore((s) => s.runAutoFixAttachShops);
  const orphans = useEditorStore((s) => s.runAutoFixRemoveOrphans);
  const merge = useEditorStore((s) => s.runAutoFixMergeOverlaps);

  const focusIssue = (i: ValidationIssue) => {
    setSel(i.id);
    if (!i.focus) return;
    const el = canvasWrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w < 8 || h < 8) return;
    focusMap(i.focus.x, i.focus.y, w, h);
  };

  const all = [...errors, ...warnings];

  return (
    <div className="validation-panel">
      <h3>Validation</h3>
      <p className="val-summary">
        <span className="err-count">{errors.length} errors</span>
        {" · "}
        <span className="warn-count">{warnings.length} warnings</span>
      </p>
      <div className="autofix-row">
        <button type="button" onClick={() => connect()}>
          Connect components
        </button>
        <button type="button" onClick={() => attach()}>
          Attach shops
        </button>
        <button type="button" onClick={() => orphans()}>
          Remove orphans
        </button>
        <button type="button" onClick={() => merge()}>
          Merge overlaps
        </button>
      </div>
      <ul className="val-list scroll issue-clickable">
        {all.length === 0 && <li className="ok">No issues</li>}
        {all.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className={`issue-line ${i.severity} ${selectedId === i.id ? "selected" : ""}`}
              onClick={() => focusIssue(i)}
            >
              <strong>{i.code}</strong>: {i.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
