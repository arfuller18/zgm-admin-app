import { loadWorkCalendarContext } from "@/lib/scheduling/context";
import { loadMonthGrid } from "@/lib/scheduling/queries";
import { CalendarMonth } from "./calendar-month";

// Server half of the infinite-scroll calendar: resolves an initial batch of
// months around the requested (or current) one, loads each month's
// placements and production-day flags, and hands the merged result to the
// client component that owns scrolling from there. Further months load via
// loadCalendarMonthAction as the user scrolls — this only ever computes the
// starting point.

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// One screen's worth to start: the requested month plus a neighbour on each
// side, so there's already something to scroll into before the first
// network round-trip for more.
const INITIAL_SPAN = 1;

export async function CalendarSection({
  variationId,
  month,
  projectId,
}: {
  variationId: string;
  month?: string;
  projectId?: string;
}) {
  const anchor = parseMonth(month);
  const ctx = await loadWorkCalendarContext(variationId);

  const monthStarts: Date[] = [];
  for (let i = -INITIAL_SPAN; i <= INITIAL_SPAN; i++) {
    monthStarts.push(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1)));
  }

  const grids = await Promise.all(
    monthStarts.map((monthStart) => loadMonthGrid({ variationId, monthStart, projectId, ctx }))
  );

  const assignmentsById = new Map<string, (typeof grids)[number]["assignments"][number]>();
  const isWorkingDay: Record<string, boolean> = {};
  for (const grid of grids) {
    for (const a of grid.assignments) assignmentsById.set(a.id, a);
    Object.assign(isWorkingDay, grid.isWorkingDay);
  }

  const now = new Date();

  return (
    <CalendarMonth
      variationId={variationId}
      projectId={projectId}
      initialMonths={monthStarts.map(monthKey)}
      assignments={[...assignmentsById.values()]}
      isWorkingDay={isWorkingDay}
      todayMonth={monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))}
      anchorMonth={monthKey(anchor)}
    />
  );
}
