import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { VARIATION_STATUS_LABEL, VARIATION_STATUS_TONE } from "@/lib/display";
import { loadSchedulingOverview, listActivelyScheduledProjects } from "@/lib/scheduling/queries";
import { getMasterVariation } from "@/lib/scheduling/variations";
import { CalendarSection } from "./calendar-section";

// The Scheduling home: Master's own current-month calendar front and
// center (it's the live schedule — the whole reason this product exists),
// with the two things worth a glance without leaving the page — the most
// active variations, and who's actually on Master right now — alongside it
// rather than buried further down.

function fmt(d: Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const TOP_VARIATIONS = 2;

export default async function SchedulePage() {
  await requireUser();
  const master = await getMasterVariation();
  const [{ masterAssignments, masterRange, variations, unscheduled, publications }, scheduledProjects] =
    await Promise.all([loadSchedulingOverview(), listActivelyScheduledProjects(master.id)]);

  // A freshly deployed database has the tables but no data until the backfill
  // runs, so point at it rather than showing a bare empty calendar.
  const needsSetup = masterAssignments === 0 && unscheduled === 0;
  const topVariations = variations.slice(0, TOP_VARIATIONS);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scheduling</h1>
        <p className="mt-1 text-muted-foreground">
          Plan in a variation, then publish to the Master Calendar.
        </p>
      </div>

      {needsSetup && (
        <div className="rounded-2xl border border-warning/30 bg-warning-bg p-5">
          <p className="font-semibold text-warning">Scheduling isn&apos;t set up on this database yet.</p>
          <p className="mt-1 text-sm text-foreground">
            The existing production calendar needs to be migrated into the scheduling engine before
            anything appears here.
          </p>
          <Link
            href="/admin/scheduling"
            className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
          >
            Open Scheduling Setup →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Master — visually distinct, and the main event on this page. */}
        <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface shadow-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-brand to-accent" />
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">Master Calendar</h2>
                  <Badge tone="brand">Operational</Badge>
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {masterAssignments} placement{masterAssignments === 1 ? "" : "s"}
                  {masterRange?.start ? ` · ${fmt(masterRange.start)} – ${fmt(masterRange.end)}` : ""}
                </p>
              </div>
              <LinkButton href="/schedule/master" size="sm">
                Open full calendar
              </LinkButton>
            </div>
            <div className="mt-4">
              <CalendarSection variationId={master.id} readOnly />
            </div>
          </div>
        </section>

        {/* Right rail: what's most worth a glance without leaving the page. */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Variations</h2>
              <Link
                href="/schedule/variations"
                className="text-xs font-medium text-brand hover:underline"
              >
                See all →
              </Link>
            </div>
            {topVariations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No variations yet — create one to start planning without touching Master.
              </p>
            ) : (
              <ul className="space-y-2">
                {topVariations.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/schedule/v/${v.id}`}
                      className="block rounded-xl border border-border p-3 transition-shadow hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{v.name}</span>
                        <Badge tone={VARIATION_STATUS_TONE[v.status]}>
                          {VARIATION_STATUS_LABEL[v.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {v._count.assignments} placement{v._count.assignments === 1 ? "" : "s"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">Active on Master</h2>
            {scheduledProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            ) : (
              <ul className="space-y-2">
                {scheduledProjects.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                      ✓
                    </span>
                    <span className="truncate">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {publications.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Recently published to Master</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {publications.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">
                    {p.sourceVariation?.name ?? "A deleted variation"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.assignmentsAdded} added
                    {p.assignmentsReplaced > 0 ? `, ${p.assignmentsReplaced} replaced` : ""}
                    {p.scope === "SELECTED_PROJECTS"
                      ? ` · ${p.projectIds.length} project${p.projectIds.length === 1 ? "" : "s"}`
                      : " · entire variation"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.publishedAt).toLocaleString()}
                  {p.publishedBy?.name ? ` · ${p.publishedBy.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
