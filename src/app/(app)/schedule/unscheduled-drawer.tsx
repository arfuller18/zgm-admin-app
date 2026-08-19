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
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-muted"
      >
        <span>
          Unscheduled
          <span className="ml-1.5 font-normal text-muted-foreground">({items.length})</span>
        </span>
        <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {items.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Everything in this schedule&apos;s projects is already placed.
            </p>
          ) : (
            <>
              <p className="mb-2 px-1 text-xs text-muted-foreground">
                Drag onto a day in the calendar to schedule it.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const color = item.projectColor ? PROJECT_COLOR_HEX[item.projectColor] : "#7c3aed";
                  return (
                    <div
                      key={item.requirementId}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(UNSCHEDULED_DRAG_TYPE, item.requirementId);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      title={`${item.projectName} · ${item.label}\n${item.durationDays} production days\nDrag onto a day to schedule`}
                      className="flex cursor-grab items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium text-white shadow-sm active:cursor-grabbing"
                      style={{ backgroundColor: color }}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">
                        ⠿
                      </span>
                      <span className="max-w-[14rem] truncate">
                        {item.projectName} · {item.label}
                      </span>
                      <span className="font-normal opacity-80">{item.durationDays}d</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
