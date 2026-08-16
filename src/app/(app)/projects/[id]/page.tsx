import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  PROJECT_FORMAT_LABEL,
  PROJECT_COLOR_HEX,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
} from "@/lib/display";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "episodes", label: "Unit Productions" },
  { key: "schedule", label: "Schedule" },
  { key: "locations", label: "Locations" },
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

  const [unitCount, phaseCount, shootDayCount, locationCount, bookingCount, contacts] =
    await Promise.all([
      prisma.unitProduction.count({ where: { projectId: id } }),
      prisma.productionSchedulePhase.count({ where: { projectId: id } }),
      prisma.shootDay.count({ where: { projectId: id } }),
      prisma.location.count({ where: { unitProductions: { some: { projectId: id } } } }),
      prisma.booking.count({ where: { projectId: id } }),
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
          <LinkButton href={`/schedule?project=${project.id}`} variant="outline">
            View on schedule
          </LinkButton>
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
  const relationLabel: Record<string, string> = {
    EXECUTIVE_OWNER: "Executive Owner",
    DAY_TO_DAY_OWNER: "Day-to-Day Owner",
    SHOWRUNNER: "Showrunner",
    KEY_TALENT: "Key Talent",
    KEY_CREW: "Key Crew",
    IMPORTANT_CONTACT: "Important Contact",
  };

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
            <Row label="ZGM owner" value={project.zgmOwner} />
            <Row label="Episode count" value={project.episodeCount?.toString()} />
            <Row label="Shoot days" value={shootDayCount.toString()} />
          </dl>
        </section>

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
                  <span className="text-xs text-muted-foreground">{relationLabel[c.relation] ?? c.relation}</span>
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
    include: { director: true, writer: true },
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
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {units.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-medium">{u.name}</td>
              <td className="px-4 py-3">{u.episode ?? "—"}</td>
              <td className="px-4 py-3">{u.episodeTitle ?? "—"}</td>
              <td className="px-4 py-3">{u.director?.fullName ?? "—"}</td>
              <td className="px-4 py-3">{u.writer?.fullName ?? "—"}</td>
              <td className="px-4 py-3">
                {u.scriptStatus ? <Badge tone="purple">{u.scriptStatus}</Badge> : "—"}
              </td>
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
