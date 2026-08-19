import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackfillButton } from "./backfill-button";

// One-off setup for the scheduling engine. Deliberately a manual button
// rather than part of the deploy: a data backfill that runs on every build
// is a much worse failure mode than one that has to be started on purpose.

export default async function AdminSchedulingPage() {
  await requireRole("ADMIN");

  const [legacyPhases, master, assignments, requirements] = await Promise.all([
    prisma.productionSchedulePhase.count(),
    prisma.scheduleVariation.findFirst({ where: { kind: "MASTER" } }),
    prisma.scheduleAssignment.count(),
    prisma.schedulingRequirement.count(),
  ]);

  const alreadyRun = requirements > 0;
  const reconciled = alreadyRun && legacyPhases === assignments;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduling Setup</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Migrates the existing production calendar into the scheduling engine and creates the
            Master Calendar. Run once per database — it is safe to run again, since every step keys
            off a stable identifier and repeats are no-ops.
          </p>
        </div>
        <Link href="/admin/sync" className="shrink-0 text-sm font-medium text-brand hover:underline">
          Airtable sync →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current state</CardTitle>
          <CardDescription>
            {alreadyRun
              ? "The scheduling engine is populated."
              : "The scheduling engine has no data yet — the Scheduling section will look empty until this runs."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Legacy phases
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{legacyPhases}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Requirements</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{requirements}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Placements</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums">{assignments}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Master Calendar
              </dt>
              <dd className="mt-1">
                {master ? (
                  <Badge tone="success">Created</Badge>
                ) : (
                  <Badge tone="neutral">Not yet</Badge>
                )}
              </dd>
            </div>
          </dl>

          {alreadyRun && (
            <p className="mt-4 text-sm">
              {reconciled ? (
                <span className="text-success">
                  Reconciled — {legacyPhases} legacy phases became {assignments} placements.
                </span>
              ) : (
                <span className="text-warning">
                  {legacyPhases} legacy phases but {assignments} placements. Run again, or check for
                  phases missing dates.
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{alreadyRun ? "Re-run backfill" : "Run backfill"}</CardTitle>
          <CardDescription>
            Creates the Master Calendar and a Mon–Fri work calendar, derives a scheduling
            requirement for every unit production and production event, and places them all on
            Master with their existing dates. Existing shoot days are linked to their new
            placements. Nothing is deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackfillButton alreadyRun={alreadyRun} />
        </CardContent>
      </Card>
    </div>
  );
}
