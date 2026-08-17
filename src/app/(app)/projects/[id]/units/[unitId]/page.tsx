import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_TONE } from "@/lib/display";
import { createTask, deleteTask } from "../../actions";
import { TaskStatusSelect } from "../../task-status-select";
import { UnitEditForm } from "./unit-edit-form";

export default async function UnitProductionPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  await requireUser();
  const { id: projectId, unitId } = await params;

  const [unit, people] = await Promise.all([
    prisma.unitProduction.findUnique({
      where: { id: unitId },
      include: {
        project: { select: { id: true, name: true } },
        director: true,
        writer: true,
        locations: true,
        shootDays: { orderBy: { date: "asc" } },
        schedulePhases: { orderBy: { startDate: "asc" } },
        bookings: { include: { person: true, location: true, equipment: true }, orderBy: { startDate: "asc" } },
        tasks: { include: { assignedTo: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      },
    }),
    prisma.person.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  if (!unit || unit.projectId !== projectId) notFound();

  const total = unit.tasks.length;
  const completed = unit.tasks.filter((t) => t.status === "COMPLETE").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <Link
        href={`/projects/${projectId}?tab=episodes`}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← {unit.project.name} · Unit Productions
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{unit.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unit.season != null ? `Season ${unit.season}` : ""}
            {unit.episode != null ? ` · Episode ${unit.episode}` : ""}
            {unit.episodeTitle ? ` · ${unit.episodeTitle}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <UnitEditForm projectId={projectId} unit={unit} people={people} />

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shoot Days</h2>
            {unit.shootDays.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No shoot days linked yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Day</th>
                      <th className="py-2 pr-4 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unit.shootDays.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-4">{d.date ? d.date.toLocaleDateString() : "—"}</td>
                        <td className="py-2 pr-4">{d.dayOfWeek ?? "—"}</td>
                        <td className="py-2 pr-4">{d.location ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tasks
            </h2>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {completed} / {total} tasks complete
                </span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {unit.tasks.length > 0 && (
              <div className="mt-4 divide-y divide-border">
                {unit.tasks.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.assignedTo?.fullName ?? "Unassigned"}
                        {t.dueDate ? ` · Due ${t.dueDate.toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.priority && (
                        <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge>
                      )}
                      <TaskStatusSelect taskId={t.id} projectId={projectId} status={t.status} />
                      <form action={deleteTask}>
                        <input type="hidden" name="taskId" value={t.id} />
                        <input type="hidden" name="projectId" value={projectId} />
                        <Button type="submit" variant="ghost" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form action={createTask} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="unitProductionId" value={unit.id} />
              <div className="grow">
                <Label htmlFor="new-unit-task-title">New task</Label>
                <Input id="new-unit-task-title" name="title" placeholder="e.g. Confirm director availability" required />
              </div>
              <div>
                <Label htmlFor="new-unit-task-priority">Priority</Label>
                <Select id="new-unit-task-priority" name="priority" defaultValue="">
                  <option value="">—</option>
                  {Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="new-unit-task-due">Due</Label>
                <Input id="new-unit-task-due" name="dueDate" type="date" />
              </div>
              <Button type="submit" variant="outline">
                + Add Task
              </Button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Locations</h2>
            {unit.locations.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None linked yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {unit.locations.map((l) => (
                  <li key={l.id}>
                    <Link href={`/locations/${l.id}`} className="font-medium text-foreground hover:text-brand">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Schedule Phases
            </h2>
            {unit.schedulePhases.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None linked yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {unit.schedulePhases.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{p.phase}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.startDate ? p.startDate.toLocaleDateString() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bookings</h2>
            {unit.bookings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {unit.bookings.map((b) => (
                  <li key={b.id}>
                    <span className="font-medium text-foreground">
                      {b.person?.fullName ?? b.location?.name ?? b.equipment?.name ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {b.startDate.toLocaleDateString()}–{b.endDate.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <LinkButton href={`/projects/${projectId}/bookings/new`} variant="outline" size="sm" className="mt-3">
              + New Booking
            </LinkButton>
          </section>
        </div>
      </div>
    </div>
  );
}
