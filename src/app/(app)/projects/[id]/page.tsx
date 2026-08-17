import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  PROJECT_FORMAT_LABEL,
  PROJECT_COLOR_HEX,
  PROJECT_CONTACT_RELATION_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  BUDGET_STATUS_LABEL,
  BUDGET_STATUS_TONE,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_TONE,
} from "@/lib/display";
import { createBudget, updateBudget, deleteBudget, createTask, deleteTask } from "./actions";
import { TaskStatusSelect } from "./task-status-select";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "episodes", label: "Unit Productions" },
  { key: "schedule", label: "Schedule" },
  { key: "locations", label: "Locations" },
  { key: "budget", label: "Budget" },
  { key: "tasks", label: "Tasks" },
  { key: "bookings", label: "Bookings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === rawTab)?.key ?? "overview") as TabKey;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const [unitCount, phaseCount, shootDayCount, locationCount, bookingCount, taskCount, contacts] =
    await Promise.all([
      prisma.unitProduction.count({ where: { projectId: id } }),
      prisma.productionSchedulePhase.count({ where: { projectId: id } }),
      prisma.shootDay.count({ where: { projectId: id } }),
      prisma.location.count({ where: { unitProductions: { some: { projectId: id } } } }),
      prisma.booking.count({ where: { projectId: id } }),
      prisma.task.count({ where: { projectId: id } }),
      prisma.projectContact.findMany({ where: { projectId: id }, include: { person: true } }),
    ]);

  const accent = project.projectColor ? PROJECT_COLOR_HEX[project.projectColor] : "#7c3aed";

  return (
    <div>
      <Link href="/projects" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← All projects
      </Link>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="h-2 w-full" style={{ backgroundColor: accent }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.projectCode ?? "No code"} ·{" "}
              {project.format ? PROJECT_FORMAT_LABEL[project.format] : "Format TBD"}
              {project.seasonFilm ? ` · ${project.seasonFilm}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.currentStatus && (
                <Badge tone={PROJECT_STATUS_TONE[project.currentStatus]}>
                  {PROJECT_STATUS_LABEL[project.currentStatus]}
                </Badge>
              )}
              {project.priority && (
                <Badge tone={PRIORITY_TONE[project.priority]}>{PRIORITY_LABEL[project.priority]} priority</Badge>
              )}
              {project.genre && <Badge tone="neutral">{project.genre}</Badge>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <LinkButton href={`/projects/${project.id}/edit`} variant="outline">
              Edit
            </LinkButton>
            <LinkButton href={`/schedule?project=${project.id}`} variant="outline">
              View on schedule
            </LinkButton>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-4">
          {TABS.map((t) => {
            const count =
              t.key === "episodes"
                ? unitCount
                : t.key === "schedule"
                  ? phaseCount
                  : t.key === "locations"
                    ? locationCount
                    : t.key === "bookings"
                      ? bookingCount
                      : t.key === "tasks"
                        ? taskCount
                        : undefined;
            return (
              <Link
                key={t.key}
                href={t.key === "overview" ? `/projects/${id}` : `/projects/${id}?tab=${t.key}`}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {count !== undefined ? ` (${count})` : ""}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab project={project} contacts={contacts} shootDayCount={shootDayCount} />}
        {tab === "episodes" && <EpisodesTab projectId={id} />}
        {tab === "schedule" && <ScheduleTab projectId={id} />}
        {tab === "locations" && <LocationsTab projectId={id} />}
        {tab === "budget" && <BudgetTab projectId={id} />}
        {tab === "tasks" && <TasksTab projectId={id} />}
        {tab === "bookings" && <BookingsTab projectId={id} />}
      </div>
    </div>
  );
}

function OverviewTab({
  project,
  contacts,
  shootDayCount,
}: {
  project: NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>>;
  contacts: Awaited<ReturnType<typeof prisma.projectContact.findMany<{ include: { person: true } }>>>;
  shootDayCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {project.logline && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Logline</h2>
            <p className="mt-2 text-foreground">{project.logline}</p>
          </section>
        )}
        {project.whyZgm && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Why ZGM / Creative Value
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{project.whyZgm}</p>
          </section>
        )}
        {project.audienceHook && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Audience / Marketing Hook
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{project.audienceHook}</p>
          </section>
        )}
        {project.biggestRisk && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Biggest Risk</h2>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{project.biggestRisk}</p>
          </section>
        )}
        {project.additionalNotes && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{project.additionalNotes}</p>
          </section>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Rights status" value={project.rightsStatus} />
            <Row label="Script status" value={project.scriptStatus} />
            <Row label="Sales / distribution" value={project.salesDistributionStatus} />
            <Row label="Casting status" value={project.castingStatus} />
            <Row label="Casting director" value={project.castingDirector} />
            <Row label="ZGM owner" value={project.zgmOwner} />
            <Row label="Episode count" value={project.episodeCount?.toString()} />
            <Row
              label="Episode length"
              value={project.episodeLength ? `${project.episodeLength} min` : undefined}
            />
            <Row label="Shoot days" value={shootDayCount.toString()} />
          </dl>
        </section>

        {(project.googleFolderUrl || project.decksBiblesUrl || project.additionalLinks) && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Links</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {project.googleFolderUrl && (
                <li>
                  <a href={project.googleFolderUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    Google Folder ↗
                  </a>
                </li>
              )}
              {project.decksBiblesUrl && (
                <li>
                  <a href={project.decksBiblesUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    Decks & Bibles ↗
                  </a>
                </li>
              )}
              {project.additionalLinks && (
                <li>
                  <a href={project.additionalLinks} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    Additional Link ↗
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}

        {(project.nextDecision || project.nextAction) && (
          <section className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-strong">What&apos;s next</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Next decision" value={project.nextDecision} />
              <Row label="Next action" value={project.nextAction} />
              <Row
                label="Due"
                value={project.nextActionDueDate ? project.nextActionDueDate.toLocaleDateString() : undefined}
              />
            </dl>
          </section>
        )}

        {contacts.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contacts</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/people/${c.personId}`} className="font-medium text-foreground hover:text-brand">
                    {c.person.fullName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {PROJECT_CONTACT_RELATION_LABEL[c.relation]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

async function EpisodesTab({ projectId }: { projectId: string }) {
  const units = await prisma.unitProduction.findMany({
    where: { projectId },
    include: { director: true, writer: true, _count: { select: { tasks: true } } },
    orderBy: [{ season: "asc" }, { episode: "asc" }],
  });

  if (units.length === 0) {
    return <EmptyState message="No unit productions yet." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Unit</th>
            <th className="px-4 py-3 font-medium">Ep</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Director</th>
            <th className="px-4 py-3 font-medium">Writer</th>
            <th className="px-4 py-3 font-medium">Script Status</th>
            <th className="px-4 py-3 font-medium">Dates</th>
            <th className="px-4 py-3 font-medium">Tasks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {units.map((u) => (
            <tr key={u.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3 font-medium">
                <Link href={`/projects/${projectId}/units/${u.id}`} className="text-brand hover:underline">
                  {u.name}
                </Link>
              </td>
              <td className="px-4 py-3">{u.episode ?? "—"}</td>
              <td className="px-4 py-3">{u.episodeTitle ?? "—"}</td>
              <td className="px-4 py-3">{u.director?.fullName ?? "—"}</td>
              <td className="px-4 py-3">{u.writer?.fullName ?? "—"}</td>
              <td className="px-4 py-3">
                {u.scriptStatus ? <Badge tone="purple">{u.scriptStatus}</Badge> : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {u.startDate ? u.startDate.toLocaleDateString() : "—"}
                {u.endDate ? ` – ${u.endDate.toLocaleDateString()}` : ""}
              </td>
              <td className="px-4 py-3">{u._count.tasks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function ScheduleTab({ projectId }: { projectId: string }) {
  const phases = await prisma.productionSchedulePhase.findMany({
    where: { projectId },
    orderBy: { startDate: "asc" },
    include: { _count: { select: { shootDays: true } } },
  });

  if (phases.length === 0) {
    return <EmptyState message="No schedule phases yet." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Phase</th>
            <th className="px-4 py-3 font-medium">Start</th>
            <th className="px-4 py-3 font-medium">End</th>
            <th className="px-4 py-3 font-medium">Work Days</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Shoot Days</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {phases.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.phase}</td>
              <td className="px-4 py-3">{p.startDate ? p.startDate.toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3">{p.endDate ? p.endDate.toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3">{p.workDays ?? "—"}</td>
              <td className="px-4 py-3">{p.location ?? "—"}</td>
              <td className="px-4 py-3">{p._count.shootDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCurrency(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber: () => number }).toNumber()
    : Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

async function BudgetTab({ projectId }: { projectId: string }) {
  const budgets = await prisma.budget.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      {budgets.map((b) => (
        <form
          key={b.id}
          action={updateBudget}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="budgetId" value={b.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Label htmlFor={`name-${b.id}`}>Name</Label>
            <Input id={`name-${b.id}`} name="name" defaultValue={b.name} />
          </div>
          <div>
            <Label htmlFor={`total-${b.id}`}>Total budget</Label>
            <Input id={`total-${b.id}`} name="totalBudget" type="number" step="0.01" defaultValue={b.totalBudget?.toString() ?? ""} />
          </div>
          <div>
            <Label htmlFor={`perEp-${b.id}`}>Budget per episode</Label>
            <Input
              id={`perEp-${b.id}`}
              name="budgetPerEpisode"
              type="number"
              step="0.01"
              defaultValue={b.budgetPerEpisode?.toString() ?? ""}
            />
          </div>
          <div>
            <Label htmlFor={`status-${b.id}`}>Status</Label>
            <Select id={`status-${b.id}`} name="status" defaultValue={b.status ?? ""}>
              <option value="">—</option>
              {Object.entries(BUDGET_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`link-${b.id}`}>Budget sheet link</Label>
            <Input id={`link-${b.id}`} name="budgetSheetsLink" type="url" defaultValue={b.budgetSheetsLink ?? ""} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label htmlFor={`notes-${b.id}`}>Notes</Label>
            <Textarea id={`notes-${b.id}`} name="notes" defaultValue={b.notes ?? ""} />
          </div>
          <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
            {b.status && <Badge tone={BUDGET_STATUS_TONE[b.status]}>{BUDGET_STATUS_LABEL[b.status]}</Badge>}
            {formatCurrency(b.totalBudget) && (
              <span className="text-sm text-muted-foreground">{formatCurrency(b.totalBudget)} total</span>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
              <Button type="submit" size="sm" variant="danger" formAction={deleteBudget}>
                Delete
              </Button>
            </div>
          </div>
        </form>
      ))}

      {budgets.length === 0 && <EmptyState message="No budgets yet." />}

      <form
        action={createBudget}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="new-budget-name">New budget name</Label>
          <Input id="new-budget-name" name="name" placeholder="e.g. Season 1 Draft Budget" required />
        </div>
        <div>
          <Label htmlFor="new-budget-total">Total budget</Label>
          <Input id="new-budget-total" name="totalBudget" type="number" step="0.01" />
        </div>
        <div>
          <Label htmlFor="new-budget-perEp">Budget per episode</Label>
          <Input id="new-budget-perEp" name="budgetPerEpisode" type="number" step="0.01" />
        </div>
        <div>
          <Label htmlFor="new-budget-status">Status</Label>
          <Select id="new-budget-status" name="status" defaultValue="">
            <option value="">—</option>
            {Object.entries(BUDGET_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline">
            + Add Budget
          </Button>
        </div>
      </form>
    </div>
  );
}

async function TasksTab({ projectId }: { projectId: string }) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: { assignedTo: true, unitProduction: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "COMPLETE").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {completed} / {total} tasks complete
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState message="No tasks yet." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3">{t.unitProduction?.name ?? "—"}</td>
                  <td className="px-4 py-3">{t.assignedTo?.fullName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {t.priority ? (
                      <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{t.dueDate ? t.dueDate.toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <TaskStatusSelect taskId={t.id} projectId={projectId} status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteTask}>
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        action={createTask}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-border bg-surface-muted/30 p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <div className="sm:col-span-2 lg:col-span-2">
          <Label htmlFor="new-task-title">New task</Label>
          <Input id="new-task-title" name="title" placeholder="e.g. Lock casting for lead role" required />
        </div>
        <div>
          <Label htmlFor="new-task-priority">Priority</Label>
          <Select id="new-task-priority" name="priority" defaultValue="">
            <option value="">—</option>
            {Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="new-task-due">Due date</Label>
          <Input id="new-task-due" name="dueDate" type="date" />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 flex items-end">
          <Button type="submit" variant="outline">
            + Add Task
          </Button>
        </div>
      </form>
    </div>
  );
}

async function LocationsTab({ projectId }: { projectId: string }) {
  const locations = await prisma.location.findMany({
    where: { unitProductions: { some: { projectId } } },
    orderBy: { name: "asc" },
  });

  if (locations.length === 0) {
    return <EmptyState message="No locations linked yet." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {locations.map((l) => (
        <Link
          key={l.id}
          href={`/locations/${l.id}`}
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <h3 className="font-semibold">{l.name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {l.locationType.map((t) => (
              <Badge key={t} tone="blue">
                {t}
              </Badge>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

async function BookingsTab({ projectId }: { projectId: string }) {
  const bookings = await prisma.booking.findMany({
    where: { projectId },
    include: { person: true, location: true, equipment: true },
    orderBy: { startDate: "asc" },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <LinkButton href={`/projects/${projectId}/bookings/new`}>+ New Booking</LinkButton>
      </div>
      {bookings.length === 0 ? (
        <EmptyState message="No bookings on this project yet." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium">
                    {b.person?.fullName ?? b.location?.name ?? b.equipment?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">{b.roleOnProject ?? "—"}</td>
                  <td className="px-4 py-3">{b.startDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3">{b.endDate.toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-10 text-center text-muted-foreground">
      {message}
    </div>
  );
}
