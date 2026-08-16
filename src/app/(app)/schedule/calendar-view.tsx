import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import {
  addMonths,
  buildCalendarWeeks,
  formatMonthYear,
  isoDateKey,
  monthParam,
  startOfMonth,
} from "@/lib/date-utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function CalendarView({
  monthStart,
  projectId,
}: {
  monthStart: Date;
  projectId?: string;
}) {
  const weeks = buildCalendarWeeks(monthStart);
  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];

  const shootDays = await prisma.shootDay.findMany({
    where: {
      date: { gte: gridStart, lte: gridEnd },
      ...(projectId ? { projectId } : {}),
    },
    include: { project: true },
    orderBy: { date: "asc" },
  });

  const byDay = new Map<string, typeof shootDays>();
  for (const sd of shootDays) {
    if (!sd.date) continue;
    const key = isoDateKey(sd.date);
    const list = byDay.get(key) ?? [];
    list.push(sd);
    byDay.set(key, list);
  }

  const prevMonth = monthParam(addMonths(monthStart, -1));
  const nextMonth = monthParam(addMonths(monthStart, 1));
  const qs = (m: string) => `?view=calendar&month=${m}${projectId ? `&project=${projectId}` : ""}`;
  const today = isoDateKey(new Date());

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{formatMonthYear(monthStart)}</h2>
        <div className="flex gap-2">
          <Link href={qs(prevMonth)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
            ← Prev
          </Link>
          <Link
            href={qs(monthParam(startOfMonth(new Date())))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
          >
            Today
          </Link>
          <Link href={qs(nextMonth)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-7 bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day) => {
            const key = isoDateKey(day);
            const dayShoots = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === monthStart.getMonth();
            const isToday = key === today;
            return (
              <div
                key={key}
                className={`min-h-24 border-b border-r border-border p-1.5 last:border-r-0 ${
                  inMonth ? "bg-surface" : "bg-surface-muted/40"
                }`}
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-brand font-semibold text-brand-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayShoots.slice(0, 3).map((sd) => (
                    <Link
                      key={sd.id}
                      href={`/projects/${sd.projectId}?tab=schedule`}
                      title={`${sd.project.name} — ${sd.shootDayCode ?? "Shoot day"}`}
                      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                      style={{
                        backgroundColor: sd.project.projectColor
                          ? PROJECT_COLOR_HEX[sd.project.projectColor]
                          : "#7c3aed",
                      }}
                    >
                      {sd.project.projectCode ?? sd.project.name}
                    </Link>
                  ))}
                  {dayShoots.length > 3 && (
                    <div className="px-1 text-[11px] text-muted-foreground">+{dayShoots.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
