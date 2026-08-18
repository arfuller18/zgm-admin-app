import { prisma } from "@/lib/prisma";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import { requirementLabel } from "@/lib/scheduling/queries";

// Gantt-style view of one schedule (a variation, or Master). Reads
// ScheduleAssignment, so it shows whichever scenario you are looking at
// rather than being hard-wired to the operational schedule.
//
// Bars are positioned by percentage across the schedule's own date range.
// Overlap is expected and drawn as-is: ZGM runs productions concurrently, so
// a timeline that assumed one-at-a-time would be lying.

const MS_PER_DAY = 86_400_000;

function monthsBetween(start: Date, end: Date) {
  const months: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function ScheduleTimeline({ variationId }: { variationId: string }) {
  const assignments = await prisma.scheduleAssignment.findMany({
    where: { variationId },
    orderBy: [{ projectId: "asc" }, { startDate: "asc" }],
    include: {
      project: { select: { id: true, name: true, projectColor: true } },
      requirement: {
        select: {
          label: true,
          unitProduction: { select: { name: true } },
          eventType: { select: { name: true } },
        },
      },
    },
  });

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-10 text-center text-sm text-muted-foreground">
        Nothing scheduled yet — placements will appear here as a timeline.
      </div>
    );
  }

  // Pad the range to whole months so the header grid lines up with the bars.
  const minStart = assignments.reduce((a, x) => (x.startDate < a ? x.startDate : a), assignments[0].startDate);
  const maxEnd = assignments.reduce((a, x) => (x.endDate > a ? x.endDate : a), assignments[0].endDate);
  const rangeStart = new Date(Date.UTC(minStart.getUTCFullYear(), minStart.getUTCMonth(), 1));
  const rangeEnd = new Date(Date.UTC(maxEnd.getUTCFullYear(), maxEnd.getUTCMonth() + 1, 1));
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();

  const months = monthsBetween(rangeStart, maxEnd);
  const pct = (date: Date) => ((date.getTime() - rangeStart.getTime()) / totalMs) * 100;

  // Group by project so each production reads as one band.
  const byProject = new Map<string, { name: string; color: string; rows: typeof assignments }>();
  for (const a of assignments) {
    const existing = byProject.get(a.projectId);
    if (existing) {
      existing.rows.push(a);
    } else {
      byProject.set(a.projectId, {
        name: a.project.name,
        color: a.project.projectColor ? PROJECT_COLOR_HEX[a.project.projectColor] : "#7c3aed",
        rows: [a],
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div style={{ minWidth: `${Math.max(months.length * 90, 640)}px` }}>
        <div className="flex border-b border-border bg-surface-muted text-xs font-medium text-muted-foreground">
          <div className="w-44 shrink-0 px-3 py-2">Project</div>
          <div className="flex flex-1">
            {months.map((m, i) => (
              <div key={i} className="flex-1 border-l border-border px-2 py-2">
                {monthLabel(m)}
              </div>
            ))}
          </div>
        </div>

        {[...byProject.entries()].map(([projectId, group]) => (
          <details key={projectId} open className="border-b border-border last:border-0">
            <summary className="flex cursor-pointer list-none items-center hover:bg-surface-muted/50">
              <div className="flex w-44 shrink-0 items-center gap-2 px-3 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="truncate text-sm font-medium">{group.name}</span>
              </div>
              <span className="px-2 text-xs text-muted-foreground">
                {group.rows.length} block{group.rows.length === 1 ? "" : "s"}
              </span>
            </summary>

            <div className="flex">
              <div className="w-44 shrink-0" />
              <div className="relative flex-1 py-1.5">
                {months.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/50"
                    style={{ left: `${(i / months.length) * 100}%` }}
                  />
                ))}

                <div className="relative" style={{ height: `${group.rows.length * 24}px` }}>
                  {group.rows.map((a, idx) => {
                    const left = pct(a.startDate);
                    // Bars are inclusive of the end day, so extend by one day.
                    const right = pct(new Date(a.endDate.getTime() + MS_PER_DAY));
                    const label = requirementLabel(a.requirement);
                    return (
                      <div
                        key={a.id}
                        title={`${label} · ${fmt(a.startDate)} – ${fmt(a.endDate)} · ${a.durationDays} production days`}
                        className="absolute flex h-5 items-center overflow-hidden rounded-full px-2 text-[11px] font-medium text-white shadow-sm"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(right - left, 0.7)}%`,
                          top: `${idx * 24}px`,
                          backgroundColor: group.color,
                        }}
                      >
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
