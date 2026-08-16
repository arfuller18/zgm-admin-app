import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import { addMonths, startOfMonth } from "@/lib/date-utils";

export async function TimelineView({ projectId }: { projectId?: string }) {
  const phases = await prisma.productionSchedulePhase.findMany({
    where: {
      startDate: { not: null },
      endDate: { not: null },
      ...(projectId ? { projectId } : {}),
    },
    include: { project: true },
    orderBy: [{ project: { name: "asc" } }, { startDate: "asc" }],
  });

  if (phases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-10 text-center text-muted-foreground">
        No dated schedule phases yet.
      </div>
    );
  }

  const allStarts = phases.map((p) => p.startDate!.getTime());
  const allEnds = phases.map((p) => p.endDate!.getTime());
  const rangeStart = startOfMonth(new Date(Math.min(...allStarts)));
  const rangeEnd = addMonths(startOfMonth(new Date(Math.max(...allEnds))), 1);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();

  const months: Date[] = [];
  for (let m = rangeStart; m < rangeEnd; m = addMonths(m, 1)) {
    months.push(m);
  }

  const byProject = new Map<string, { name: string; color: string; phases: typeof phases }>();
  for (const phase of phases) {
    const existing = byProject.get(phase.projectId);
    const color = phase.project.projectColor ? PROJECT_COLOR_HEX[phase.project.projectColor] : "#7c3aed";
    if (existing) {
      existing.phases.push(phase);
    } else {
      byProject.set(phase.projectId, { name: phase.project.name, color, phases: [phase] });
    }
  }

  const pct = (date: Date) => ((date.getTime() - rangeStart.getTime()) / totalMs) * 100;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div style={{ minWidth: `${months.length * 110}px` }}>
        <div className="flex border-b border-border bg-surface-muted text-xs font-medium text-muted-foreground">
          <div className="w-40 shrink-0 px-3 py-2">Project</div>
          <div className="relative flex-1">
            <div className="flex">
              {months.map((m, i) => (
                <div key={i} className="flex-1 border-l border-border px-2 py-2">
                  {m.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {Array.from(byProject.entries()).map(([pid, group]) => (
          <div key={pid} className="flex border-b border-border last:border-0">
            <Link
              href={`/projects/${pid}?tab=schedule`}
              className="w-40 shrink-0 truncate px-3 py-3 text-sm font-medium hover:text-brand"
            >
              {group.name}
            </Link>
            <div className="relative flex-1 py-2">
              {months.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-border/60"
                  style={{ left: `${(i / months.length) * 100}%` }}
                />
              ))}
              <div className="relative" style={{ height: `${group.phases.length * 26}px` }}>
                {group.phases.map((phase, idx) => {
                  const left = pct(phase.startDate!);
                  const width = Math.max(pct(phase.endDate!) - left, 0.6);
                  return (
                    <div
                      key={phase.id}
                      title={`${phase.phase} · ${phase.startDate!.toLocaleDateString()} – ${phase.endDate!.toLocaleDateString()}`}
                      className="absolute flex h-5 items-center overflow-hidden rounded-full px-2 text-[11px] font-medium text-white shadow-sm"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${idx * 26}px`,
                        backgroundColor: group.color,
                      }}
                    >
                      <span className="truncate">{phase.phase}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
