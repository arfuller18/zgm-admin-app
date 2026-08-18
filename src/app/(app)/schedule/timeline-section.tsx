import { loadScheduleWindow } from "@/lib/scheduling/queries";
import { loadWorkCalendarContext } from "@/lib/scheduling/context";
import {
  formatScheduleDate,
  addCalendarDays,
  isProductionDay,
} from "@/lib/scheduling/work-calendar";
import { TimelineGantt, type Zoom } from "./timeline-gantt";

// Server half of the Gantt: resolves the visible window for whichever zoom
// level is active, loads placements intersecting it, and precomputes which
// days are production days — the same split as the month calendar, and for
// the same reason: work-calendar rules belong in exactly one place.

const ZOOMS: Zoom[] = ["week", "month", "quarter", "year"];

function parseAnchor(anchor: string | undefined): Date {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const [y, m, d] = anchor.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The visible [start, end] window and a step size for ← / →, per zoom. */
function windowFor(zoom: Zoom, anchor: Date): { start: Date; end: Date; stepDays: number } {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();

  switch (zoom) {
    case "week": {
      // Four weeks, anchor's week first — enough runway to see a block
      // approaching without the day columns getting unreadably thin.
      const start = addCalendarDays(anchor, -anchor.getUTCDay());
      return { start, end: addCalendarDays(start, 27), stepDays: 28 };
    }
    case "month": {
      const start = new Date(Date.UTC(y, m, 1));
      const end = new Date(Date.UTC(y, m + 2, 0)); // two months
      return { start, end, stepDays: 0 };
    }
    case "quarter": {
      const qStart = m - (m % 3);
      const start = new Date(Date.UTC(y, qStart, 1));
      const end = new Date(Date.UTC(y, qStart + 6, 0)); // two quarters
      return { start, end, stepDays: 0 };
    }
    case "year": {
      const start = new Date(Date.UTC(y, 0, 1));
      const end = new Date(Date.UTC(y + 1, 11, 31));
      return { start, end, stepDays: 0 }; // two years
    }
  }
}

function shiftAnchor(zoom: Zoom, anchor: Date, dir: 1 | -1): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  switch (zoom) {
    case "week":
      return addCalendarDays(anchor, dir * 28);
    case "month":
      return new Date(Date.UTC(y, m + dir * 3, 1));
    case "quarter":
      return new Date(Date.UTC(y, m + dir * 6, 1));
    case "year":
      return new Date(Date.UTC(y + dir * 2, 0, 1));
  }
}

export async function TimelineSection({
  variationId,
  zoomParam,
  anchorParam,
  projectId,
  basePath,
  editable = true,
}: {
  variationId: string;
  zoomParam?: string;
  anchorParam?: string;
  projectId?: string;
  basePath: string;
  editable?: boolean;
}) {
  const zoom: Zoom = ZOOMS.includes(zoomParam as Zoom) ? (zoomParam as Zoom) : "month";
  const anchor = parseAnchor(anchorParam);
  const { start, end } = windowFor(zoom, anchor);

  const [assignments, ctx] = await Promise.all([
    loadScheduleWindow({ variationId, from: start, to: end, projectId }),
    loadWorkCalendarContext(variationId),
  ]);

  const nonWorkingDays: string[] = [];
  for (let d = start; d <= end; d = addCalendarDays(d, 1)) {
    if (!isProductionDay(d, ctx)) nonWorkingDays.push(formatScheduleDate(d));
  }

  const qs = (z: Zoom, a: Date) => {
    const p = new URLSearchParams();
    p.set("view", "timeline");
    p.set("zoom", z);
    p.set("anchor", formatScheduleDate(a));
    if (projectId) p.set("project", projectId);
    return `${basePath}?${p.toString()}`;
  };

  const prevAnchor = shiftAnchor(zoom, anchor, -1);
  const nextAnchor = shiftAnchor(zoom, anchor, 1);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const zoomHrefs = Object.fromEntries(ZOOMS.map((z) => [z, qs(z, anchor)])) as Record<Zoom, string>;

  const periodLabel =
    zoom === "week" || zoom === "month"
      ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : zoom === "quarter"
        ? `${start.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`
        : `${start.getUTCFullYear()} – ${end.getUTCFullYear()}`;

  return (
    <TimelineGantt
      variationId={variationId}
      zoom={zoom}
      windowStart={formatScheduleDate(start)}
      windowEnd={formatScheduleDate(end)}
      assignments={assignments.map((a) => ({
        ...a,
        startDate: formatScheduleDate(a.startDate),
        endDate: formatScheduleDate(a.endDate),
      }))}
      nonWorkingDays={nonWorkingDays}
      prevHref={qs(zoom, prevAnchor)}
      nextHref={qs(zoom, nextAnchor)}
      todayHref={qs(zoom, today)}
      zoomHrefs={zoomHrefs}
      periodLabel={periodLabel}
      editable={editable}
    />
  );
}
