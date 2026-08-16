import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";
import { getGlobalConflicts } from "@/lib/conflicts";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import { addDays } from "@/lib/date-utils";

export default async function DashboardPage() {
  const user = await requireUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksOut = addDays(today, 14);

  const [projects, upcomingShootDays, bookingCount, conflicts] = await Promise.all([
    prisma.project.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    prisma.shootDay.findMany({
      where: { date: { gte: today, lte: twoWeeksOut } },
      include: { project: true },
      orderBy: { date: "asc" },
      take: 8,
    }),
    prisma.booking.count({ where: { status: { not: "CANCELLED" } } }),
    getGlobalConflicts(),
  ]);

  const activeProjects = projects.filter((p) => p.currentStatus && p.currentStatus !== "PAUSED");
  const highPriority = projects.filter((p) => p.priority === "HIGH");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name?.split(" ")[0] ?? "there"}.</h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s where every ZGM production stands today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Projects" value={activeProjects.length} tone="brand" href="/projects" />
        <StatTile label="High Priority" value={highPriority.length} tone="danger" href="/projects" />
        <StatTile
          label="Shoot Days (14d)"
          value={upcomingShootDays.length}
          tone="success"
          href="/schedule"
        />
        <StatTile
          label="Open Conflicts"
          value={conflicts.length}
          tone={conflicts.length > 0 ? "danger" : "success"}
          href="#conflicts"
        />
      </div>

      {conflicts.length > 0 && (
        <section id="conflicts" className="rounded-2xl border border-danger/30 bg-danger-bg/40 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-danger">
            <Badge tone="danger">{conflicts.length}</Badge>
            Double-booking conflicts need attention
          </h2>
          <ul className="mt-3 space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-lg bg-surface p-3 text-sm shadow-sm">
                <span className="font-semibold">{c.resourceName}</span> is booked on both{" "}
                <Link href={`/projects/${c.bookingA.projectId}`} className="font-medium text-brand hover:underline">
                  {c.bookingA.projectName}
                </Link>{" "}
                ({new Date(c.bookingA.startDate).toLocaleDateString()}–
                {new Date(c.bookingA.endDate).toLocaleDateString()}) and{" "}
                <Link href={`/projects/${c.bookingB.projectId}`} className="font-medium text-brand hover:underline">
                  {c.bookingB.projectName}
                </Link>{" "}
                ({new Date(c.bookingB.startDate).toLocaleDateString()}–
                {new Date(c.bookingB.endDate).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Link href="/projects" className="text-sm font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.slice(0, 4).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Next 14 days</h2>
            <Link href="/schedule" className="text-sm font-medium text-brand hover:underline">
              Full schedule →
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-2">
            {upcomingShootDays.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No shoot days scheduled in this window.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingShootDays.map((sd) => (
                  <li key={sd.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: sd.project.projectColor
                            ? PROJECT_COLOR_HEX[sd.project.projectColor]
                            : "#7c3aed",
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium">{sd.project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sd.date?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${sd.projectId}?tab=schedule`}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total active bookings</span>
              <span className="font-semibold">{bookingCount}</span>
            </div>
          </div>

          <LinkButton href="/projects" variant="outline" className="mt-4 w-full">
            Browse all projects
          </LinkButton>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: "brand" | "danger" | "success";
  href: string;
}) {
  const toneClasses = {
    brand: "text-brand-strong bg-brand/10",
    danger: "text-danger bg-danger-bg",
    success: "text-success bg-success-bg",
  } as const;

  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-black/[0.03] transition-shadow hover:shadow-md"
    >
      <div className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </Link>
  );
}
