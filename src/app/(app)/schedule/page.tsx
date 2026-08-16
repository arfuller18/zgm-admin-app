import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseMonthParam } from "@/lib/date-utils";
import { CalendarView } from "./calendar-view";
import { TimelineView } from "./timeline-view";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; project?: string }>;
}) {
  await requireUser();
  const { view: rawView, month, project: projectId } = await searchParams;
  const view = rawView === "timeline" ? "timeline" : "calendar";
  const monthStart = parseMonthParam(month, new Date());

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, projectCode: true },
  });

  const baseQs = new URLSearchParams();
  if (projectId) baseQs.set("project", projectId);

  const viewHref = (v: string) => {
    const qs = new URLSearchParams(baseQs);
    qs.set("view", v);
    if (v === "calendar" && month) qs.set("month", month);
    return `/schedule?${qs.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="mt-1 text-muted-foreground">
            Every project&apos;s shoot days and production phases, in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex gap-2">
            <select
              name="project"
              defaultValue={projectId ?? ""}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ?? p.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="view" value={view} />
            <button
              type="submit"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              Filter
            </button>
          </form>
          <div className="flex overflow-hidden rounded-lg border border-border text-sm">
            <Link
              href={viewHref("calendar")}
              className={`px-3 py-2 font-medium ${view === "calendar" ? "bg-brand text-brand-foreground" : "hover:bg-surface-muted"}`}
            >
              Calendar
            </Link>
            <Link
              href={viewHref("timeline")}
              className={`px-3 py-2 font-medium ${view === "timeline" ? "bg-brand text-brand-foreground" : "hover:bg-surface-muted"}`}
            >
              Timeline
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {view === "calendar" ? (
          <CalendarView monthStart={monthStart} projectId={projectId} />
        ) : (
          <TimelineView projectId={projectId} />
        )}
      </div>
    </div>
  );
}
