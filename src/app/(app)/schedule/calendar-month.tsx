"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import { moveAssignmentToDate, type ScheduleConflictView } from "./actions";
import type { ScheduleWindowAssignment } from "@/lib/scheduling/queries";

// Interactive month calendar. Multi-day placements render as continuous bars
// across each week row, lane-packed so overlapping productions stack instead
// of colliding — ZGM runs several shows at once, so overlap is the normal
// case, not an error state.
//
// Dragging a bar onto a day sets that placement's START date; the end date
// follows from its duration via the work calendar. That is deliberately the
// only drag semantic: "grab the middle and shift by the offset" reads as
// clever but makes precise placement guesswork.

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Assignment = Omit<ScheduleWindowAssignment, "startDate" | "endDate"> & {
  startDate: string;
  endDate: string;
};

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * MS_PER_DAY);
}
function pretty(iso: string) {
  return parse(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Sun–Sat weeks covering the month, including adjacent-month bleed. */
function buildWeeks(monthStart: Date) {
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getUTCDay());
  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Place bars into lanes within one week so overlapping bars never sit on top
 * of each other. First-fit: a bar takes the topmost lane whose occupied
 * columns it does not touch.
 */
function packLanes<T extends { startCol: number; span: number }>(segments: T[]): T[][] {
  const lanes: T[][] = [];
  for (const seg of segments) {
    let placed = false;
    for (const lane of lanes) {
      const clashes = lane.some(
        (s) => seg.startCol < s.startCol + s.span && s.startCol < seg.startCol + seg.span
      );
      if (!clashes) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }
  return lanes;
}

export function CalendarMonth({
  variationId,
  monthIso,
  assignments: initial,
  isWorkingDay,
  prevHref,
  nextHref,
  todayHref,
}: {
  variationId: string;
  monthIso: string; // "YYYY-MM-01"
  assignments: Assignment[];
  /** ISO date → whether it is a production day, precomputed on the server. */
  isWorkingDay: Record<string, boolean>;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<{
    movedLabel: string;
    conflicts: ScheduleConflictView[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Server data wins whenever the page re-renders with a new set.
  const initialKey = useMemo(
    () => initial.map((a) => `${a.id}:${a.startDate}`).join("|"),
    [initial]
  );
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setItems(initial);
  }

  const monthStart = parse(monthIso);
  const weeks = useMemo(() => buildWeeks(monthStart), [monthIso]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayIso = fmt(new Date());

  function onDrop(dayIso: string) {
    const id = dragId;
    setDragId(null);
    setHoverDay(null);
    if (!id) return;

    const target = items.find((a) => a.id === id);
    if (!target || target.startDate === dayIso) return;

    // Optimistic: shift the bar by the same number of calendar days so it
    // moves under the cursor immediately. The server re-derives the true end
    // date from the work calendar and we reconcile below.
    const delta = Math.round((parse(dayIso).getTime() - parse(target.startDate).getTime()) / MS_PER_DAY);
    setItems((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, startDate: dayIso, endDate: fmt(addDays(parse(a.endDate), delta)) }
          : a
      )
    );
    setError(null);
    setConflictNotice(null);

    startTransition(async () => {
      const res = await moveAssignmentToDate({ assignmentId: id, variationId, isoDate: dayIso });
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, startDate: res.startDate, endDate: res.endDate } : a
          )
        );
        // The move already happened — a location conflict here is a
        // heads-up, not a rollback reason. A scheduler may mean it.
        if (res.conflicts.length > 0) {
          setConflictNotice({ movedLabel: target.label, conflicts: res.conflicts });
        }
      } else {
        setItems(initial); // roll back
        setError(res.message);
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">
          {monthStart.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h3>
        <div className="flex items-center gap-2">
          {isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
          <div className="flex overflow-hidden rounded-lg border border-border text-sm">
            <Link href={prevHref} className="px-3 py-1.5 hover:bg-surface-muted">
              ←
            </Link>
            <Link href={todayHref} className="border-x border-border px-3 py-1.5 hover:bg-surface-muted">
              Today
            </Link>
            <Link href={nextHref} className="px-3 py-1.5 hover:bg-surface-muted">
              →
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {conflictNotice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
          <p>
            <strong>{conflictNotice.movedLabel}</strong> now shares a location with{" "}
            {conflictNotice.conflicts.map((c, i) => (
              <span key={i}>
                {i > 0 ? ", " : ""}
                <strong>{c.projectName}</strong> · {c.label} ({pretty(c.startDate)} – {pretty(c.endDate)})
              </span>
            ))}{" "}
            at {conflictNotice.conflicts[0].locationName} on overlapping days. The move went through —
            this is just a heads-up.
          </p>
          <button
            type="button"
            onClick={() => setConflictNotice(null)}
            className="shrink-0 text-warning/70 hover:text-warning"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-7 bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEnd = week[6];

          // Clip each placement to this week and note where it sits.
          const segments = items
            .map((a) => {
              const s = parse(a.startDate);
              const e = parse(a.endDate);
              if (e < weekStart || s > weekEnd) return null;
              const clippedStart = s < weekStart ? weekStart : s;
              const clippedEnd = e > weekEnd ? weekEnd : e;
              return {
                assignment: a,
                startCol: clippedStart.getUTCDay(),
                span: Math.round((clippedEnd.getTime() - clippedStart.getTime()) / MS_PER_DAY) + 1,
                continuesLeft: s < weekStart,
                continuesRight: e > weekEnd,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

          const lanes = packLanes(segments);

          return (
            <div key={wi} className="border-t border-border">
              {/* Day numbers + drop targets */}
              <div className="grid grid-cols-7">
                {week.map((day) => {
                  const iso = fmt(day);
                  const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();
                  const working = isWorkingDay[iso] ?? false;
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={iso}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoverDay(iso);
                      }}
                      onDragLeave={() => setHoverDay((h) => (h === iso ? null : h))}
                      onDrop={() => onDrop(iso)}
                      className={[
                        "min-h-11 border-r border-border px-2 py-1.5 last:border-r-0",
                        // Non-production days are shaded so a planner can see
                        // at a glance why a block skipped them.
                        working ? "" : "bg-surface-muted/60",
                        inMonth ? "" : "opacity-45",
                        hoverDay === iso ? "bg-brand/10 ring-1 ring-inset ring-brand" : "",
                      ].join(" ")}
                    >
                      <span
                        className={
                          isToday
                            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground"
                            : "text-[11px] text-muted-foreground"
                        }
                      >
                        {day.getUTCDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bars, one row per lane */}
              <div className="space-y-0.5 px-0 pb-1.5">
                {lanes.map((lane, li) => (
                  <div key={li} className="grid grid-cols-7 gap-0">
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let col = 0;
                      for (const seg of lane.sort((a, b) => a.startCol - b.startCol)) {
                        if (seg.startCol > col) {
                          cells.push(<div key={`gap-${col}`} style={{ gridColumn: `span ${seg.startCol - col}` }} />);
                        }
                        const a = seg.assignment;
                        const color = a.projectColor ? PROJECT_COLOR_HEX[a.projectColor] : "#7c3aed";
                        cells.push(
                          <div key={a.id} style={{ gridColumn: `span ${seg.span}` }} className="px-1">
                            <div
                              draggable
                              onDragStart={() => setDragId(a.id)}
                              onDragEnd={() => {
                                setDragId(null);
                                setHoverDay(null);
                              }}
                              title={`${a.projectName} · ${a.label}\n${pretty(a.startDate)} – ${pretty(a.endDate)} · ${a.durationDays} production days\nDrag onto a day to move`}
                              className={[
                                "cursor-grab truncate px-2 py-0.5 text-[11px] font-medium text-white shadow-sm active:cursor-grabbing",
                                seg.continuesLeft ? "rounded-l-none" : "rounded-l-full",
                                seg.continuesRight ? "rounded-r-none" : "rounded-r-full",
                                dragId === a.id ? "opacity-50" : "",
                              ].join(" ")}
                              style={{ backgroundColor: color }}
                            >
                              {seg.continuesLeft ? "… " : ""}
                              {a.label}
                            </div>
                          </div>
                        );
                        col = seg.startCol + seg.span;
                      }
                      if (col < 7) {
                        cells.push(<div key="tail" style={{ gridColumn: `span ${7 - col}` }} />);
                      }
                      return cells;
                    })()}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Drag a block onto a day to move it. Its length in production days is preserved, and shaded
        days are skipped automatically.
      </p>

      {items.length === 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Nothing scheduled in this month.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[...new Map(items.map((a) => [a.projectId, a])).values()].map((a) => (
            <Badge
              key={a.projectId}
              tone="neutral"
              className="gap-1.5"
              style={{
                borderLeft: `3px solid ${a.projectColor ? PROJECT_COLOR_HEX[a.projectColor] : "#7c3aed"}`,
              }}
            >
              {a.projectName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
