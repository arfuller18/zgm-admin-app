"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BackfillSummary } from "@/lib/scheduling/backfill";
import { runBackfill } from "./actions";

type Result = { ok: true; summary: BackfillSummary } | { ok: false; error: string };

const ROW_LABELS: Partial<Record<keyof BackfillSummary, string>> = {
  legacyPhases: "Legacy schedule phases found",
  masterAssignments: "Placements now on Master",
  unitRequirementsFromPhases: "Unit production requirements",
  eventRequirementsCreated: "Production event requirements created",
  draftRequirementsForUnscheduledUnits: "Units left unscheduled (drafts)",
  totalRequirements: "Total requirements",
  shootDaysReparented: "Shoot days linked to placements",
  shootDaysStillUnparented: "Shoot days still unlinked",
  shootDayLocationsResolved: "Shoot day locations matched to records",
  eventTypes: "Production event types available",
};

export function BackfillButton({ alreadyRun }: { alreadyRun: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div>
      <Button
        disabled={isPending}
        variant={alreadyRun ? "outline" : "primary"}
        onClick={() =>
          startTransition(async () => {
            setResult(await runBackfill());
          })
        }
      >
        {isPending ? "Running…" : alreadyRun ? "Run again" : "Run backfill"}
      </Button>

      {result && !result.ok && (
        <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{result.error}</p>
      )}

      {result?.ok && (
        <div className="mt-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Backfill complete</span>
            <Badge tone={result.summary.reconciled === "YES" ? "success" : "danger"}>
              {result.summary.reconciled === "YES"
                ? "Reconciled"
                : "Mismatch — check the counts"}
            </Badge>
          </div>
          <dl className="divide-y divide-border text-sm">
            {(Object.keys(ROW_LABELS) as (keyof BackfillSummary)[]).map((key) => (
              <div key={key} className="flex items-center justify-between px-4 py-2">
                <dt className="text-muted-foreground">{ROW_LABELS[key]}</dt>
                <dd className="font-medium tabular-nums">{String(result.summary[key])}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            &ldquo;Legacy schedule phases&rdquo; and &ldquo;Placements now on Master&rdquo; should
            match. Nothing was deleted — the legacy tables are untouched.
          </p>
        </div>
      )}
    </div>
  );
}
