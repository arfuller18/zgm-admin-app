import { loadScheduleWindow } from "@/lib/scheduling/queries";
import { loadWorkCalendarContext } from "@/lib/scheduling/context";
import {
  formatScheduleDate,
  addCalendarDays,
  isProductionDay,
} from "@/lib/scheduling/work-calendar";
import { CalendarMonth } from "./calendar-month";

// Server half of the month calendar: resolves the window, loads placements,
// and precomputes which days are production days so the client never has to
// reimplement work-calendar rules. Keeping that decision on the server is the
// whole point — two implementations of "is this a working day" would drift.

function monthParam(d: Date) {
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

export async function CalendarSection({
  variationId,
  month,
  projectId,
  basePath,
}: {
  variationId: string;
  month?: string;
  projectId?: string;
  basePath: string;
}) {
  const monthStart = parseMonth(month);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));

  // The visible grid bleeds into adjacent months, so widen the window.
  const gridStart = addCalendarDays(monthStart, -monthStart.getUTCDay());
  const gridEnd = addCalendarDays(monthEnd, 6 - monthEnd.getUTCDay());

  const [assignments, ctx] = await Promise.all([
    loadScheduleWindow({ variationId, from: gridStart, to: gridEnd, projectId }),
    loadWorkCalendarContext(variationId),
  ]);

  const isWorkingDay: Record<string, boolean> = {};
  for (let d = gridStart; d <= gridEnd; d = addCalendarDays(d, 1)) {
    isWorkingDay[formatScheduleDate(d)] = isProductionDay(d, ctx);
  }

  const qs = (m: string) => {
    const p = new URLSearchParams();
    p.set("view", "calendar");
    p.set("month", m);
    if (projectId) p.set("project", projectId);
    return `${basePath}?${p.toString()}`;
  };

  const prevMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const now = new Date();

  return (
    <CalendarMonth
      variationId={variationId}
      monthIso={formatScheduleDate(monthStart)}
      assignments={assignments.map((a) => ({
        ...a,
        startDate: formatScheduleDate(a.startDate),
        endDate: formatScheduleDate(a.endDate),
      }))}
      isWorkingDay={isWorkingDay}
      prevHref={qs(monthParam(prevMonth))}
      nextHref={qs(monthParam(nextMonth))}
      todayHref={qs(monthParam(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))))}
    />
  );
}
