import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { VARIATION_STATUS_LABEL, VARIATION_STATUS_TONE } from "@/lib/display";
import { loadSchedulingOverview, listSchedulableProjects } from "@/lib/scheduling/queries";
import { NewVariationForm } from "./new-variation-form";

// The Scheduling home. Master sits at the top as an operational calendar in
// its own right — variations are listed separately, below, as the planning
// workspaces they are. The two are never presented as peers.

function fmt(d: Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function SchedulePage() {
  await requireUser();
  const [{ master, masterAssignments, masterRange, variations, unscheduled, publications }, allProjects] =
    await Promise.all([loadSchedulingOverview(), listSchedulableProjects()]);

  // A freshly deployed database has the tables but no data until the backfill
  // runs, so point at it rather than showing a bare empty calendar.
  const needsSetup = masterAssignments === 0 && unscheduled === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduling</h1>
          <p className="mt-1 text-muted-foreground">
            Plan in a variation, then publish to the Master Calendar.
          </p>
        </div>
        <LinkButton href="/schedule/compare" variant="outline">
          Compare schedules
        </LinkButton>
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

      {/* Master — visually distinct, listed first, never inside the variations list. */}
      <section className="overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-brand to-accent" />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Master Calendar</h2>
              <Badge tone="brand">Operational</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              ZGM&apos;s current production schedule — what the company is actually doing. Changes
              land here only when a variation is published.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled</dt>
                <dd className="font-semibold">{masterAssignments} placements</dd>
              </div>
              {masterRange?.start && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Covers</dt>
                  <dd className="font-semibold">
                    {fmt(masterRange.start)} – {fmt(masterRange.end)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Awaiting scheduling
                </dt>
                <dd className="font-semibold">{unscheduled} requirements</dd>
              </div>
            </dl>
          </div>
          <LinkButton href="/schedule/master">Open Master Calendar</LinkButton>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Schedule variations</h2>
            <p className="text-sm text-muted-foreground">
              Planning scenarios. Nothing here affects the Master Calendar until it&apos;s published.
            </p>
          </div>
        </div>

        {variations.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface-muted/50 p-8 text-center text-sm text-muted-foreground">
            No variations yet. Create one below to start planning without touching Master.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {variations.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/schedule/v/${v.id}`}
                  className="block h-full rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{v.name}</span>
                    <Badge tone={VARIATION_STATUS_TONE[v.status]}>
                      {VARIATION_STATUS_LABEL[v.status]}
                    </Badge>
                  </div>
                  {v.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {v.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {v._count.assignments} placement{v._count.assignments === 1 ? "" : "s"}
                    {v.sourceVariation ? ` · from ${v.sourceVariation.name}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <NewVariationForm
            variations={variations.map((v) => ({
              id: v.id,
              name: v.name,
              includedProjectIds: v.includedProjectIds,
            }))}
            allProjects={allProjects}
            masterIncludedProjectIds={master?.includedProjectIds ?? []}
          />
        </div>
      </section>

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
