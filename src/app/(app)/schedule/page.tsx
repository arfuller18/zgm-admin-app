import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { loadSchedulingOverview } from "@/lib/scheduling/queries";

// The Scheduling home: an overview, not the place variations are managed —
// that's its own tab now (see scheduling-nav.tsx). Master sits here as an
// operational calendar in its own right, plus a variations count that links
// out rather than a full picker grid duplicating the Variations tab.

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
  const { masterAssignments, masterRange, variations, unscheduled, publications } =
    await loadSchedulingOverview();

  // A freshly deployed database has the tables but no data until the backfill
  // runs, so point at it rather than showing a bare empty calendar.
  const needsSetup = masterAssignments === 0 && unscheduled === 0;

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

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6">
        <div>
          <h2 className="text-lg font-semibold">Schedule variations</h2>
          <p className="text-sm text-muted-foreground">
            {variations.length} planning scenario{variations.length === 1 ? "" : "s"}, isolated from
            Master until published.
          </p>
        </div>
        <LinkButton href="/schedule/variations" variant="outline">
          Manage variations
        </LinkButton>
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
