"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { addIncludedProjectAction, removeIncludedProjectAction } from "./actions";

// Which projects a schedule is scoped to — editable at any time, not just at
// creation. Toggling here is what the filter bubbles, the bulk-shift scope
// picker, and eventually the unscheduled-events drawer all read from, so
// this is the one place that controls all three.
//
// The panel is portaled to <body> and positioned from the trigger button's
// own bounding rect rather than CSS `absolute` inside the filter row: that
// row wraps (adding a project bubble can push this button onto its own
// line), and a `left`/`right`-anchored absolute panel breaks the moment its
// offset parent's position shifts — it clips off whichever edge the button
// happened to land near. Measuring the real button position sidesteps that
// entirely, same fix as the app-rail drawer's containing-block problem.

export function ManageProjects({
  variationId,
  includedProjectIds,
  allProjects,
}: {
  variationId: string;
  includedProjectIds: string[];
  allProjects: { id: string; name: string }[];
}) {
  const PANEL_WIDTH = 256; // w-64
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Anchor to the button's left edge and grow rightward, but clamp so
      // it can never run off either side — the button's own position can't
      // be trusted (the filter row wraps, so it can land anywhere).
      const left = Math.min(
        Math.max(rect.left + window.scrollX, 8),
        window.scrollX + window.innerWidth - PANEL_WIDTH - 8
      );
      setCoords({ top: rect.bottom + window.scrollY + 6, left });
    }
    setOpen(true);
  }

  function toggle(projectId: string, currentlyIncluded: boolean) {
    setPendingId(projectId);
    startTransition(async () => {
      if (currentlyIncluded) {
        await removeIncludedProjectAction({ variationId, projectId });
      } else {
        await addIncludedProjectAction({ variationId, projectId });
      }
      setPendingId(null);
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground"
      >
        {open ? "Done" : "+ Manage projects"}
      </button>

      {open &&
        createPortal(
          <>
            {/* Full-screen catch-all to close on outside click, matching the
                app-rail drawer's own overlay-click-to-dismiss pattern. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg"
              style={{ top: coords.top, left: coords.left }}
            >
              <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
                Which projects should this schedule cover?
              </p>
              <div className="max-h-72 overflow-y-auto">
                {allProjects.map((p) => {
                  const included = includedProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted"
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={isPending && pendingId === p.id}
                        onChange={() => toggle(p.id, included)}
                      />
                      {p.name}
                    </label>
                  );
                })}
                {allProjects.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet.</p>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
