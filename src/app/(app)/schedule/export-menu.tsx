"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// A schedule report in three shapes, all built from the same rows server-
// side. There is no separate "export to Google Sheets": CSV opens directly
// there via File → Import, so it covers that case without a second
// integration (and a real Sheets push would need its own OAuth consent
// flow this app doesn't otherwise ask for).
const FORMATS: { format: "pdf" | "xlsx" | "csv"; label: string }[] = [
  { format: "pdf", label: "PDF" },
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV — opens in Google Sheets" },
];

export function ExportMenu({ variationId, projectId }: { variationId: string; projectId?: string }) {
  const PANEL_WIDTH = 224;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // No window.scrollX/scrollY: this menu is `position: fixed`, whose
      // containing block is the viewport, so getBoundingClientRect's
      // already-viewport-relative numbers need no scroll offset added.
      const left = Math.min(Math.max(rect.right - PANEL_WIDTH, 8), window.innerWidth - PANEL_WIDTH - 8);
      setCoords({ top: rect.bottom + 6, left });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
      >
        Export ▾
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
              style={{ top: coords.top, left: coords.left }}
            >
              {FORMATS.map(({ format, label }) => {
                const params = new URLSearchParams({ variationId, format });
                if (projectId) params.set("projectId", projectId);
                return (
                  <a
                    key={format}
                    href={`/api/schedule/export?${params.toString()}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2.5 py-1.5 text-sm hover:bg-surface-muted"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
