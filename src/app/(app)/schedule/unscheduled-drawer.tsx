"use client";

import { useState } from "react";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import type { UnscheduledItem } from "@/lib/scheduling/queries";

// The drawer's items are plain drag sources: dropping one is handled by
// whatever calendar day receives it (calendar-month.tsx), communicated
// purely through the browser's own dataTransfer — no shared React state
// needed between this component and the calendar, since HTML5 drag-and-drop
// is a DOM-level protocol that already crosses component boundaries.
export const UNSCHEDULED_DRAG_TYPE = "application/x-schedule-requirement";

export function UnscheduledDrawer({ items }: { items: UnscheduledItem[] }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Show unscheduled"
        className="flex h-fit shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-2 py-4 text-muted-foreground hover:bg-surface-muted"
      >
        <span aria-hidden className="text-xs">
          ▸
        </span>
        <span className="text-xs font-medium [writing-mode:vertical-rl]">
          Unscheduled ({items.length})
        </span>
      </button>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold">
          Unscheduled
          <span className="ml-1.5 font-normal text-muted-foreground">({items.length})</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse"
          className="rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          ‹
        </button>
      </div>

      <div className="max-h-[75vh] overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <p className="p-1.5 text-sm text-muted-foreground">
            Everything in this schedule&apos;s projects is already placed.
          </p>
        ) : (
          <>
            <p className="mb-2 px-1 text-xs text-muted-foreground">
              Drag onto a day in the calendar to schedule it.
            </p>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => {
                const color = item.projectColor ? PROJECT_COLOR_HEX[item.projectColor] : "#8b5cf6";
                return (
                  <div
                    key={item.requirementId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(UNSCHEDULED_DRAG_TYPE, item.requirementId);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title={`${item.projectName} · ${item.label}\n${item.durationDays} production days\nDrag onto a day to schedule`}
                    className="flex cursor-grab items-start gap-2 rounded-xl border-l-4 bg-surface-muted px-2.5 py-2 text-xs shadow-sm active:cursor-grabbing"
                    style={{ borderLeftColor: color }}
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground">⠿</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {item.projectName}
                      </span>
                      <span className="block truncate text-muted-foreground">{item.label}</span>
                    </span>
                    <span className="shrink-0 font-medium text-muted-foreground">
                      {item.durationDays}d
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
