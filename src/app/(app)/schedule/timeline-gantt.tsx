"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import {
  parseScheduleDate as parse,
  formatScheduleDate as fmt,
  addCalendarDays as addDays,
  calendarDaysBetween,
} from "@/lib/scheduling/work-calendar";
import {
  moveAssignmentToDate,
  resizeAssignmentToEnd,
  resizeAssignmentFromStart,
} from "./actions";
import type { ScheduleWindowAssignment } from "@/lib/scheduling/queries";

// Zoomable Gantt. One horizontal scale, four zoom levels, and every bar
// positioned by day offset from the window start — so a bar's pixel geometry
// and the date it means are the same fact, and a drag can be read straight
// back off the cursor.
//
// Two things stay firmly on the server: which days are production days, and
// what a dragged edge means in production days. The client moves pixels and
// shows an optimistic guess; the engine decides, and the bar snaps to what it
// decided. That is why dropping a block onto a Saturday visibly jumps to
// Monday instead of quietly lying about it.

export type Zoom = "week" | "month" | "quarter" | "year";

/** Column width in pixels for one day, per zoom level. */
const PX_PER_DAY: Record<Zoom, number> = {
  week: 88,
  month: 30,
  quarter: 11,
  year: 3.6,
};

/** Below this, a bar shows no text — a clipped word is worse than none. */
const MIN_LABEL_PX = 46;
const ROW_H = 26;
const RAIL_W = 184;

type Assignment = Omit<ScheduleWindowAssignment, "startDate" | "endDate"> & {
  startDate: string;
  endDate: string;
};

type Drag = {
  id: string;
  mode: "move" | "start" | "end";
  originX: number;
  startDate: string;
  endDate: string;
};

function pretty(iso: string) {
  return parse(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TimelineGantt({
  variationId,
  zoom,
  windowStart,
  windowEnd,
  assignments: initial,
  nonWorkingDays,
  prevHref,
  nextHref,
  todayHref,
  zoomHrefs,
  periodLabel,
  editable,
}: {
  variationId: string;
  zoom: Zoom;
  windowStart: string;
  windowEnd: string;
  assignments: Assignment[];
  /** ISO dates in the window that are not production days. */
  nonWorkingDays: string[];
  prevHref: string;
  nextHref: string;
  todayHref: string;
  zoomHrefs: Record<Zoom, string>;
  periodLabel: string;
  editable: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ id: string; start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const laneRef = useRef<HTMLDivElement>(null);

  // Server data wins on re-render. Comparing the placements themselves (not
  // just their count) is what makes a navigation or a published push show up.
  const initialKey = useMemo(
    () => initial.map((a) => `${a.id}:${a.startDate}:${a.endDate}`).join("|"),
    [initial]
  );
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setItems(initial);
    setGhost(null);
  }

  const start = parse(windowStart);
  const totalDays = calendarDaysBetween(start, parse(windowEnd));
  const px = PX_PER_DAY[zoom];
  const gridWidth = totalDays * px;
  const nonWorking = useMemo(() => new Set(nonWorkingDays), [nonWorkingDays]);
  const todayIso = fmt(new Date());

  const offsetOf = useCallback((iso: string) => calendarDaysBetween(start, parse(iso)) - 1, [start]);

  // ---------------------------------------------------------------------
  // Grouping — one band per project, ordered as the rest of the app orders
  // projects so the eye can move between views without re-learning.
  // ---------------------------------------------------------------------
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; color: string; priority: string | null; rows: Assignment[] }
    >();
    for (const a of items) {
      let g = map.get(a.projectId);
      if (!g) {
        g = {
          id: a.projectId,
          name: a.projectName,
          color: a.projectColor ? PROJECT_COLOR_HEX[a.projectColor] : "#7c3aed",
          priority: a.projectPriority as string | null,
          rows: [],
        };
        map.set(a.projectId, g);
      }
      g.rows.push(a);
    }
    const order = ["HIGH", "MEDIUM", "LOW"];
    return [...map.values()]
      .map((g) => ({
        ...g,
        rows: [...g.rows].sort((x, y) => x.startDate.localeCompare(y.startDate)),
      }))
      .sort((a, b) => {
        const pa = a.priority ? order.indexOf(a.priority) : order.length;
        const pb = b.priority ? order.indexOf(b.priority) : order.length;
        return pa - pb || a.name.localeCompare(b.name);
      });
  }, [items]);

  // ---------------------------------------------------------------------
  // Header ticks. Two tiers: a coarse band (month, or year at year zoom) and
  // a fine one (days, weeks, or months depending on how much room there is).
  // ---------------------------------------------------------------------
  const { majorTicks, minorTicks } = useMemo(() => {
    const major: { key: string; label: string; offset: number; days: number }[] = [];
    const minor: { key: string; label: string; offset: number; days: number }[] = [];

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      const iso = fmt(d);
      const first = d.getUTCDate() === 1;

      // Coarse band
      const majorNew = zoom === "year" ? first && d.getUTCMonth() === 0 : first;
      if (i === 0 || majorNew) {
        major.push({
          key: iso,
          offset: i,
          days: 0,
          label:
            zoom === "year"
              ? String(d.getUTCFullYear())
              : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
        });
      }

      // Fine band
      if (zoom === "week" || zoom === "month") {
        minor.push({
          key: iso,
          offset: i,
          days: 1,
          label:
            zoom === "week"
              ? `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()}`
              : String(d.getUTCDate()),
        });
      } else if (zoom === "quarter") {
        if (i === 0 || d.getUTCDay() === 1) {
          minor.push({
            key: iso,
            offset: i,
            days: 0,
            label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
          });
        }
      } else if (first) {
        minor.push({
          key: iso,
          offset: i,
          days: 0,
          label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        });
      }
    }

    const close = (ticks: typeof major) => {
      for (let i = 0; i < ticks.length; i++) {
        if (ticks[i].days === 0) {
          ticks[i].days = (ticks[i + 1]?.offset ?? totalDays) - ticks[i].offset;
        }
      }
      return ticks;
    };

    return { majorTicks: close(major), minorTicks: close(minor) };
  }, [start, totalDays, zoom]);

  // ---------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------
  function beginDrag(e: React.PointerEvent, a: Assignment, mode: Drag["mode"]) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ id: a.id, mode, originX: e.clientX, startDate: a.startDate, endDate: a.endDate });
    setGhost({ id: a.id, start: a.startDate, end: a.endDate });
    setError(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const shift = Math.round((e.clientX - drag.originX) / px);
    const s = parse(drag.startDate);
    const en = parse(drag.endDate);

    if (drag.mode === "move") {
      setGhost({
        id: drag.id,
        start: fmt(addDays(s, shift)),
        end: fmt(addDays(en, shift)),
      });
    } else if (drag.mode === "end") {
      const next = addDays(en, shift);
      setGhost({ id: drag.id, start: drag.startDate, end: fmt(next < s ? s : next) });
    } else {
      const next = addDays(s, shift);
      setGhost({ id: drag.id, start: fmt(next > en ? en : next), end: drag.endDate });
    }
  }

  function endDrag() {
    const d = drag;
    const g = ghost;
    setDrag(null);
    if (!d || !g) return;

    const unchanged = g.start === d.startDate && g.end === d.endDate;
    if (unchanged) {
      setGhost(null);
      return;
    }

    // Show the guess immediately; reconcile with the engine's answer below.
    setItems((prev) =>
      prev.map((a) => (a.id === d.id ? { ...a, startDate: g.start, endDate: g.end } : a))
    );

    const call =
      d.mode === "move"
        ? moveAssignmentToDate({ assignmentId: d.id, variationId, isoDate: g.start })
        : d.mode === "end"
          ? resizeAssignmentToEnd({ assignmentId: d.id, variationId, isoDate: g.end })
          : resizeAssignmentFromStart({ assignmentId: d.id, variationId, isoDate: g.start });

    startTransition(async () => {
      const res = await call;
      setGhost(null);
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === d.id
              ? { ...a, startDate: res.startDate, endDate: res.endDate, durationDays: res.durationDays }
              : a
          )
        );
      } else {
        setItems(initial);
        setError(res.message);
      }
    });
  }

  // ---------------------------------------------------------------------

  const zoomTab = (z: Zoom, label: string) => (
    <Link
      key={z}
      href={zoomHrefs[z]}
      className={`px-3 py-1.5 text-sm font-medium ${
        zoom === z ? "bg-brand text-brand-foreground" : "hover:bg-surface-muted"
      }`}
    >
      {label}
    </Link>
  );

  function bar(a: Assignment, color: string, rowTop: number, muted = false) {
    const g = ghost?.id === a.id ? ghost : null;
    const sIso = g?.start ?? a.startDate;
    const eIso = g?.end ?? a.endDate;
    const from = offsetOf(sIso);
    const span = calendarDaysBetween(parse(sIso), parse(eIso));

    // Clip to the window so a block running past the edge still draws.
    const left = Math.max(from, 0) * px;
    const right = Math.min(from + span, totalDays) * px;
    const width = Math.max(right - left, 3);
    if (right <= 0 || left >= gridWidth) return null;

    const clippedLeft = from < 0;
    const clippedRight = from + span > totalDays;
    const showLabel = width >= MIN_LABEL_PX;

    return (
      <div
        key={a.id}
        className={`group absolute flex items-center ${muted ? "opacity-70" : ""}`}
        style={{ left, width, top: rowTop + 3, height: ROW_H - 8 }}
      >
        <div
          onPointerDown={(e) => beginDrag(e, a, "move")}
          title={`${a.projectName} · ${a.label}\n${pretty(a.startDate)} – ${pretty(a.endDate)} · ${a.durationDays} production days${editable ? "\nDrag to move, drag an edge to resize" : ""}`}
          className={[
            "flex h-full w-full items-center overflow-hidden px-2 text-[11px] font-medium text-white shadow-sm",
            editable ? "cursor-grab active:cursor-grabbing" : "",
            clippedLeft ? "rounded-l-none" : "rounded-l-full",
            clippedRight ? "rounded-r-none" : "rounded-r-full",
            drag?.id === a.id ? "ring-2 ring-foreground/40" : "",
            // A dashed edge is the honest signal that the block keeps going
            // past the window rather than ending here.
            clippedLeft || clippedRight ? "border-y border-white/40" : "",
          ].join(" ")}
          style={{ backgroundColor: color, touchAction: "none" }}
        >
          {showLabel && (
            <span className="truncate">
              {clippedLeft ? "… " : ""}
              {a.label}
              {width >= 150 && (
                <span className="ml-1.5 font-normal opacity-80">{a.durationDays}d</span>
              )}
            </span>
          )}
        </div>

        {editable && !clippedLeft && (
          <span
            onPointerDown={(e) => beginDrag(e, a, "start")}
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-full opacity-0 group-hover:bg-foreground/25 group-hover:opacity-100"
            style={{ touchAction: "none" }}
          />
        )}
        {editable && !clippedRight && (
          <span
            onPointerDown={(e) => beginDrag(e, a, "end")}
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-full opacity-0 group-hover:bg-foreground/25 group-hover:opacity-100"
            style={{ touchAction: "none" }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{periodLabel}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {zoomTab("week", "Week")}
            {zoomTab("month", "Month")}
            {zoomTab("quarter", "Quarter")}
            {zoomTab("year", "Year")}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border text-sm">
            <Link href={prevHref} className="px-3 py-1.5 hover:bg-surface-muted">
              ←
            </Link>
            <Link
              href={todayHref}
              className="border-x border-border px-3 py-1.5 hover:bg-surface-muted"
            >
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

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-10 text-center text-sm text-muted-foreground">
          Nothing scheduled in this window. Use ← → to look elsewhere, or zoom out.
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-border bg-surface"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div style={{ minWidth: RAIL_W + gridWidth }}>
            {/* Header */}
            <div className="sticky top-0 z-20 border-b border-border bg-surface-muted">
              <div className="flex">
                <div
                  className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface-muted px-3 py-1 text-xs font-semibold"
                  style={{ width: RAIL_W }}
                >
                  Project
                </div>
                <div className="relative" style={{ width: gridWidth, height: 22 }}>
                  {majorTicks.map((t) => (
                    <div
                      key={t.key}
                      className="absolute top-0 h-full truncate border-l border-border px-2 text-xs font-semibold"
                      style={{ left: t.offset * px, width: t.days * px }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex">
                <div
                  className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface-muted"
                  style={{ width: RAIL_W }}
                />
                <div className="relative" style={{ width: gridWidth, height: 20 }}>
                  {minorTicks.map((t) => {
                    const iso = t.key;
                    const off = nonWorking.has(iso) && (zoom === "week" || zoom === "month");
                    return (
                      <div
                        key={iso}
                        className={`absolute top-0 h-full overflow-hidden border-l border-border/60 text-center text-[10px] leading-5 ${
                          iso === todayIso
                            ? "font-bold text-brand"
                            : off
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground"
                        }`}
                        style={{ left: t.offset * px, width: t.days * px }}
                      >
                        {t.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bands */}
            {groups.map((g) => {
              const isCollapsed = collapsed[g.id] ?? false;
              const rows = isCollapsed ? 1 : g.rows.length;
              const height = rows * ROW_H + 6;

              return (
                <div key={g.id} className="flex border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [g.id]: !(c[g.id] ?? false) }))
                    }
                    className="sticky left-0 z-10 flex shrink-0 items-start gap-2 border-r border-border bg-surface px-3 py-2 text-left hover:bg-surface-muted"
                    style={{ width: RAIL_W }}
                  >
                    <span
                      className={`mt-0.5 shrink-0 text-[10px] text-muted-foreground transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    >
                      ▶
                    </span>
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{g.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {g.rows.length} block{g.rows.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>

                  <div className="relative" style={{ width: gridWidth, height }} ref={laneRef}>
                    {/* Non-production shading, drawn only where a day is wide
                        enough to read as a band rather than as noise. */}
                    {(zoom === "week" || zoom === "month" || zoom === "quarter") &&
                      nonWorkingDays.map((iso) => {
                        const off = offsetOf(iso);
                        if (off < 0 || off >= totalDays) return null;
                        return (
                          <div
                            key={iso}
                            className="absolute top-0 bottom-0 bg-surface-muted/70"
                            style={{ left: off * px, width: px }}
                          />
                        );
                      })}

                    {minorTicks.map((t) => (
                      <div
                        key={t.key}
                        className="absolute top-0 bottom-0 border-l border-border/40"
                        style={{ left: t.offset * px }}
                      />
                    ))}

                    {(() => {
                      const off = offsetOf(todayIso);
                      if (off < 0 || off >= totalDays) return null;
                      return (
                        <div
                          className="absolute top-0 bottom-0 z-10 w-px bg-brand"
                          style={{ left: off * px + px / 2 }}
                        />
                      );
                    })()}

                    {isCollapsed
                      ? g.rows.map((a) => bar(a, g.color, 3, true))
                      : g.rows.map((a, i) => bar(a, g.color, i * ROW_H + 3))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {editable
          ? "Drag a bar to move it, or drag either edge to resize. Durations are counted in production days, so shaded days are skipped."
          : "Read-only view."}{" "}
        Click a project name to collapse its rows onto one line.
      </p>
    </div>
  );
}
