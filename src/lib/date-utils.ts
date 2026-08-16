const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

export function formatMonthYear(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function isoDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseMonthParam(month: string | undefined, fallback: Date) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return startOfMonth(fallback);
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function monthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Weeks (Sun-Sat) covering the full month, including the leading/trailing
// days from adjacent months needed to fill the grid.
export function buildCalendarWeeks(monthStart: Date): Date[][] {
  const monthEnd = endOfMonth(monthStart);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());

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

export function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}
