"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// What clicking a calendar block opens: the same three actions the List
// view's per-assignment row offers (move, resize, unschedule), but reachable
// without leaving the calendar. Dragging a block or its edges covers the
// same ground roughly, not precisely — this is for "exactly this date" or
// "exactly this many days."
//
// Portaled to <body> and positioned from the clicked block's own bounding
// rect, same fix as the app-rail drawer and ManageProjects' dropdown: a
// CSS-absolute panel breaks the moment its offset parent shifts (a week row
// re-packing lanes, the page scrolling), and this sidesteps that.

export function BlockPopover({
  projectName,
  label,
  startIso,
  prettyRange,
  durationDays,
  top,
  left,
  busy,
  onClose,
  onMove,
  onResize,
  onDelete,
}: {
  projectName: string;
  label: string;
  startIso: string;
  prettyRange: string;
  durationDays: number;
  top: number;
  left: number;
  busy: boolean;
  onClose: () => void;
  onMove: (isoDate: string) => void;
  onResize: (days: number) => void;
  onDelete: () => void;
}) {
  const [moveDate, setMoveDate] = useState(startIso);
  const [days, setDays] = useState(String(durationDays));

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg"
        style={{ top, left }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{projectName}</p>
            <p className="truncate text-xs text-muted-foreground">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">{prettyRange}</p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="popover-move-date">
              Move to start date
            </label>
            <div className="flex gap-1.5">
              <Input
                id="popover-move-date"
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="!w-auto flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !moveDate || moveDate === startIso}
                onClick={() => onMove(moveDate)}
              >
                Move
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="popover-duration">
              Duration (production days)
            </label>
            <div className="flex gap-1.5">
              <Input
                id="popover-duration"
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="!w-auto flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !days || Number(days) < 1 || Number(days) === durationDays}
                onClick={() => onResize(Number(days))}
              >
                Resize
              </Button>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={onDelete}
            className="w-full"
          >
            Remove from schedule
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
