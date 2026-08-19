"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import {
  moveAssignmentToDate,
  resizeAssignmentToEnd,
  resizeAssignmentFromStart,
  resizeAssignmentDuration,
  unassignAssignmentTyped,
  assignRequirementToDate,
  loadCalendarMonthAction,
  type ScheduleConflictView,
} from "./actions";
import { UNSCHEDULED_DRAG_TYPE } from "./unscheduled-drawer";
import { BlockPopover } from "./block-popover";
import { ExportMenu } from "./export-menu";
import type { ScheduleWindowAssignment } from "@/lib/scheduling/queries";

// Infinite-scroll month calendar. Multi-day placements render as continuous
// bars across each week row, lane-packed so overlapping productions stack
// instead of colliding — ZGM runs several shows at once, so overlap is the
// normal case, not an error state.
//
// Dragging a bar onto a day sets that placement's START date; the end date
// follows from its duration via the work calendar. That is deliberately the
// only drag semantic: "grab the middle and shift by the offset" reads as
// clever but makes precise placement guesswork.
//
// Scrolling: months accumulate client-side as sentinels above/below the
// loaded range come into view — nothing already rendered is ever unmounted,
// which is deliberately not "true" virtualization. At the scale one
// production company's schedule reaches (tens of months, at most a few
// hundred placements), the DOM cost of keeping everything mounted is
// negligible next to the complexity a windowing library would add, and it
// means drag-and-drop never has to worry about a bar disappearing out from
// under a pointer that's still down.

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// A generous but finite backstop against runaway loading (a stuck
// IntersectionObserver re-firing, a scroll-wheel fling past the edge
// before data arrives) — 36 months either side of where someone started
// is far more runway than any real planning horizon needs.
const MAX_LOADED_MONTHS = 72;

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

/** "YYYY-MM" → "August 2026". */
function monthLabel(monthKey: string) {
  return parse(`${monthKey}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function shiftMonthKey(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

/** What's being dragged: the whole block (a move), or just one edge (a resize). */
type Drag = { id: string; mode: "move" | "start" | "end" };

export function CalendarMonth({
  variationId,
  projectId,
  initialMonths,
  assignments: initialAssignments,
  isWorkingDay: initialIsWorkingDay,
  todayMonth,
  anchorMonth,
}: {
  variationId: string;
  projectId?: string;
  /** "YYYY-MM" keys, ascending — the months loaded by the server on first render. */
  initialMonths: string[];
  assignments: Assignment[];
  isWorkingDay: Record<string, boolean>;
  todayMonth: string;
  /** The month the page should already be scrolled to on load. */
  anchorMonth: string;
}) {
  const [months, setMonths] = useState(initialMonths);
  const [items, setItems] = useState(initialAssignments);
  const [isWorkingDay, setIsWorkingDay] = useState(initialIsWorkingDay);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ id: string; top: number; left: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<{
    movedLabel: string;
    conflicts: ScheduleConflictView[];
  } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Read inside the IntersectionObserver callback, which is set up once and
  // would otherwise close over stale values from whichever render it was
  // created in. Synced via effect, not during render — mutating a ref while
  // rendering breaks React's purity guarantees even though nothing here
  // reads it back for this render's own output.
  const liveRef = useRef({ months, isLoadingMore: false });
  useEffect(() => {
    liveRef.current.months = months;
  }, [months]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prependHeightBefore = useRef<number | null>(null);

  const todayIso = fmt(new Date());

  function loadMore(direction: "before" | "after") {
    if (liveRef.current.isLoadingMore) return;
    const current = liveRef.current.months;
    if (current.length >= MAX_LOADED_MONTHS) return;
    const targetMonth =
      direction === "before" ? shiftMonthKey(current[0], -1) : shiftMonthKey(current[current.length - 1], 1);
    if (current.includes(targetMonth)) return;

    liveRef.current.isLoadingMore = true;
    setIsLoadingMore(true);
    // Prepending shifts everything below it down; capture the height now so
    // the effect below can compensate scrollTop once the new month mounts,
    // keeping whatever the user was looking at in place.
    if (direction === "before" && scrollRef.current) {
      prependHeightBefore.current = scrollRef.current.scrollHeight;
    }

    startTransition(async () => {
      const res = await loadCalendarMonthAction({ variationId, month: targetMonth, projectId });
      setItems((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...res.assignments.filter((a) => !seen.has(a.id))];
      });
      setIsWorkingDay((prev) => ({ ...prev, ...res.isWorkingDay }));
      setMonths((prev) => (direction === "before" ? [targetMonth, ...prev] : [...prev, targetMonth]));
      liveRef.current.isLoadingMore = false;
      setIsLoadingMore(false);
    });
  }

  useEffect(() => {
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    const root = scrollRef.current;
    if (!topEl || !bottomEl || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === topEl) loadMore("before");
          else if (entry.target === bottomEl) loadMore("after");
        }
      },
      { root, rootMargin: "800px 0px" }
    );
    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
    // variationId/projectId are the only props loadMore's closure depends on
    // that can actually change; months/isLoadingMore are read live via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationId, projectId]);

  useEffect(() => {
    if (prependHeightBefore.current !== null && scrollRef.current) {
      const added = scrollRef.current.scrollHeight - prependHeightBefore.current;
      scrollRef.current.scrollTop += added;
      prependHeightBefore.current = null;
    }
  }, [months]);

  // Scrolls only this component's own scroll container, never the page —
  // Element.scrollIntoView walks every scrollable ancestor, including the
  // outer page, which drags the whole layout down to chase a month buried
  // inside an already-scrollable panel. Measuring the offset and setting
  // scrollTop directly stays contained to the one element meant to move.
  function scrollToMonth(monthKey: string) {
    const container = scrollRef.current;
    const target = monthRefs.current[monthKey];
    if (!container || !target) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    container.scrollTop += targetRect.top - containerRect.top;
  }

  // Land on the relevant month without making anyone click for it — the
  // requested (or current) month is always the middle of the initial batch,
  // so an untouched scroll position would otherwise open one month early.
  // Guarded by a ref, not just an empty deps array: React's Strict Mode
  // double-invokes effects in dev, and the second firing can land after an
  // auto-triggered month prepend (the generous IntersectionObserver
  // rootMargin below often fires immediately on mount) already shifted
  // everything down — recomputing the scroll delta a second time against
  // that already-adjusted layout double-counts the shift. A ref makes the
  // actual scroll a true one-time effect regardless of how many times the
  // effect body runs.
  const didAutoScroll = useRef(false);
  useEffect(() => {
    if (didAutoScroll.current) return;
    didAutoScroll.current = true;
    scrollToMonth(anchorMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToToday() {
    scrollToMonth(todayMonth);
  }

  function openPopover(id: string, el: HTMLElement) {
    const POPOVER_WIDTH = 288; // w-72
    // A generous estimate, not a measurement — the popover's content is
    // fixed (no dynamic list to grow it), so this only has to be tall
    // enough that "flip above" triggers whenever the real content wouldn't
    // fit below. A `fixed`-position element can't be scrolled into reach by
    // scrolling the page, so a block near the bottom of the calendar needs
    // this flip, not just horizontal clamping.
    const POPOVER_HEIGHT = 320;
    const rect = el.getBoundingClientRect();
    // No window.scrollX/scrollY: the popover is `position: fixed`, whose
    // containing block is the viewport, so getBoundingClientRect's
    // already-viewport-relative numbers need no scroll offset added.
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - POPOVER_WIDTH - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= POPOVER_HEIGHT + 8 ? rect.bottom + 6 : Math.max(8, rect.top - POPOVER_HEIGHT - 6);
    setPopover({ id, top, left });
  }

  /**
   * A brand-new placement from the unscheduled drawer, not an existing bar
   * being moved. No prior row to reconcile — the item simply doesn't exist
   * in `items` until the server confirms it, so there's nothing to guess
   * optimistically beyond showing the pending state.
   */
  function onDropUnscheduled(requirementId: string, dayIso: string) {
    setError(null);
    setConflictNotice(null);
    startTransition(async () => {
      const res = await assignRequirementToDate({ requirementId, variationId, isoDate: dayIso });
      if (res.ok) {
        setItems((prev) => [...prev, res.assignment]);
        if (res.conflicts.length > 0) {
          setConflictNotice({ movedLabel: res.assignment.label, conflicts: res.conflicts });
        }
      } else {
        setError(res.message);
      }
    });
  }

  /** Drag the whole block onto a day: sets the start date, duration follows. */
  function performMove(id: string, dayIso: string) {
    const target = items.find((a) => a.id === id);
    if (!target || target.startDate === dayIso) return;
    const before = { startDate: target.startDate, endDate: target.endDate };

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
        // Roll back only this one placement — other months loaded via
        // scroll (or other successful edits) aren't this action's to undo.
        setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...before } : a)));
        setError(res.message);
      }
    });
  }

  /** Drag one edge onto a day: that edge moves, the other stays put. */
  function performResizeEdge(id: string, mode: "start" | "end", dayIso: string) {
    const target = items.find((a) => a.id === id);
    if (!target) return;
    if (dayIso === (mode === "end" ? target.endDate : target.startDate)) return;
    const before = { startDate: target.startDate, endDate: target.endDate, durationDays: target.durationDays };

    setItems((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (mode === "end") {
          return { ...a, endDate: parse(dayIso) < parse(a.startDate) ? a.startDate : dayIso };
        }
        return { ...a, startDate: parse(dayIso) > parse(a.endDate) ? a.endDate : dayIso };
      })
    );
    setError(null);
    setConflictNotice(null);

    startTransition(async () => {
      const res =
        mode === "end"
          ? await resizeAssignmentToEnd({ assignmentId: id, variationId, isoDate: dayIso })
          : await resizeAssignmentFromStart({ assignmentId: id, variationId, isoDate: dayIso });
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, startDate: res.startDate, endDate: res.endDate, durationDays: res.durationDays }
              : a
          )
        );
        if (res.conflicts.length > 0) {
          setConflictNotice({ movedLabel: target.label, conflicts: res.conflicts });
        }
      } else {
        setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...before } : a)));
        setError(res.message);
      }
    });
  }

  /** Precise duration entry from the block popover — same edit, typed input instead of a drag. */
  function performResizeDuration(id: string, days: number) {
    const target = items.find((a) => a.id === id);
    if (!target || days === target.durationDays) return;
    const before = { endDate: target.endDate, durationDays: target.durationDays };

    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, durationDays: days } : a)));
    setError(null);
    setConflictNotice(null);

    startTransition(async () => {
      const res = await resizeAssignmentDuration({ assignmentId: id, variationId, durationDays: days });
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, startDate: res.startDate, endDate: res.endDate, durationDays: res.durationDays }
              : a
          )
        );
        if (res.conflicts.length > 0) {
          setConflictNotice({ movedLabel: target.label, conflicts: res.conflicts });
        }
      } else {
        setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...before } : a)));
        setError(res.message);
      }
    });
  }

  /** The popover's delete button: unschedule, same soft semantics as the List view's. */
  function performDelete(id: string) {
    const target = items.find((a) => a.id === id);
    if (!target) return;
    setItems((prev) => prev.filter((a) => a.id !== id));
    setError(null);
    setConflictNotice(null);

    startTransition(async () => {
      const res = await unassignAssignmentTyped({ assignmentId: id, variationId });
      if (!res.ok) {
        // The unschedule didn't actually happen — put the block back.
        setItems((prev) => [...prev, target]);
        setError(res.message);
      }
    });
  }

  function onDrop(dayIso: string, e: React.DragEvent) {
    setHoverDay(null);

    // The drawer sets this MIME type on drag start; it's how a brand-new
    // placement is told apart from an existing bar being moved, without any
    // shared React state between this component and the drawer.
    const requirementId = e.dataTransfer.getData(UNSCHEDULED_DRAG_TYPE);
    if (requirementId) {
      onDropUnscheduled(requirementId, dayIso);
      return;
    }

    const current = drag;
    setDrag(null);
    if (!current) return;

    if (current.mode === "move") {
      performMove(current.id, dayIso);
    } else {
      performResizeEdge(current.id, current.mode, dayIso);
    }
  }

  function renderMonth(monthKey: string) {
    const monthStart = parse(`${monthKey}-01`);
    const weeks = buildWeeks(monthStart);

    return (
      <div
        key={monthKey}
        ref={(el) => {
          monthRefs.current[monthKey] = el;
        }}
      >
        <div className="border-y border-border bg-surface-muted/70 px-3 py-1.5 text-sm font-semibold">
          {monthLabel(monthKey)}
        </div>

        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEnd = week[6];

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
                      onDrop={(e) => onDrop(iso, e)}
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
                          cells.push(
                            <div key={`gap-${col}`} style={{ gridColumn: `span ${seg.startCol - col}` }} />
                          );
                        }
                        const a = seg.assignment;
                        const color = a.projectColor ? PROJECT_COLOR_HEX[a.projectColor] : "#8b5cf6";
                        cells.push(
                          <div key={a.id} style={{ gridColumn: `span ${seg.span}` }} className="px-1">
                            <div className="group relative">
                              <div
                                draggable
                                onDragStart={() => setDrag({ id: a.id, mode: "move" })}
                                onDragEnd={() => {
                                  setDrag(null);
                                  setHoverDay(null);
                                }}
                                onClick={(e) => openPopover(a.id, e.currentTarget)}
                                title={`${a.projectName} · ${a.label}\n${pretty(a.startDate)} – ${pretty(a.endDate)} · ${a.durationDays} production days\nDrag to move, drag an edge to resize, click for details`}
                                className={[
                                  "cursor-grab truncate px-2 py-0.5 text-[11px] font-medium text-white shadow-sm active:cursor-grabbing",
                                  seg.continuesLeft ? "rounded-l-none" : "rounded-l-full",
                                  seg.continuesRight ? "rounded-r-none" : "rounded-r-full",
                                  drag?.id === a.id ? "opacity-50" : "",
                                ].join(" ")}
                                style={{ backgroundColor: color }}
                              >
                                {seg.continuesLeft ? "… " : ""}
                                {a.label}
                              </div>

                              {/* Resize handles only where a segment is the assignment's
                                  true start/end — a mid-bar week-wrap segment has neither. */}
                              {!seg.continuesLeft && (
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDrag({ id: a.id, mode: "start" });
                                  }}
                                  onDragEnd={() => {
                                    setDrag(null);
                                    setHoverDay(null);
                                  }}
                                  title="Drag to resize the start"
                                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:bg-black/20 group-hover:opacity-100"
                                />
                              )}
                              {!seg.continuesRight && (
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDrag({ id: a.id, mode: "end" });
                                  }}
                                  onDragEnd={() => {
                                    setDrag(null);
                                    setHoverDay(null);
                                  }}
                                  title="Drag to resize the end"
                                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:bg-black/20 group-hover:opacity-100"
                                />
                              )}
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
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Calendar</h3>
        <div className="flex items-center gap-2">
          {(isPending || isLoadingMore) && (
            <span className="text-xs text-muted-foreground">
              {isLoadingMore ? "Loading more…" : "Saving…"}
            </span>
          )}
          <button
            type="button"
            onClick={scrollToToday}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
          >
            Today
          </button>
          <ExportMenu variationId={variationId} projectId={projectId} />
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

      <div
        ref={scrollRef}
        // overflow-anchor: none — the browser's own scroll anchoring already
        // tries to keep content stable when a month is prepended above the
        // viewport, and it fights the explicit prependHeightBefore
        // compensation above: both adjust scrollTop for the same insertion,
        // double-counting the shift. One mechanism has to own this.
        style={{ overflowAnchor: "none" }}
        className="max-h-[75vh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface"
      >
        <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>

        <div ref={topSentinelRef} />

        {months.map((m) => renderMonth(m))}

        <div ref={bottomSentinelRef} />
      </div>

      {popover &&
        (() => {
          const a = items.find((x) => x.id === popover.id);
          if (!a) return null;
          return (
            <BlockPopover
              projectName={a.projectName}
              label={a.label}
              startIso={a.startDate}
              prettyRange={`${pretty(a.startDate)} – ${pretty(a.endDate)}`}
              durationDays={a.durationDays}
              top={popover.top}
              left={popover.left}
              busy={isPending}
              onClose={() => setPopover(null)}
              onMove={(isoDate) => {
                setPopover(null);
                performMove(a.id, isoDate);
              }}
              onResize={(days) => {
                setPopover(null);
                performResizeDuration(a.id, days);
              }}
              onDelete={() => {
                setPopover(null);
                performDelete(a.id);
              }}
            />
          );
        })()}

      <p className="mt-2 text-xs text-muted-foreground">
        Drag a block to move it, or drag either edge to resize — click a block for precise controls
        or to remove it. Drag an item from the unscheduled list to place it. Length in production
        days is preserved, and shaded days are skipped automatically. Scroll to load more months.
      </p>

      {items.length === 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">Nothing scheduled yet.</p>
      )}

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[...new Map(items.map((a) => [a.projectId, a])).values()].map((a) => (
            <Badge
              key={a.projectId}
              tone="neutral"
              className="gap-1.5"
              style={{
                borderLeft: `3px solid ${a.projectColor ? PROJECT_COLOR_HEX[a.projectColor] : "#8b5cf6"}`,
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
