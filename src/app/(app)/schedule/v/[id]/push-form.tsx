"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  pushToMasterAction,
  loadMergedMasterPreview,
  previewPushConflictsAction,
  type ActionState,
  type PushLocationConflictView,
} from "../../actions";
import { TimelineGantt, type Zoom } from "../../timeline-gantt";
import type { PushPreview } from "@/lib/scheduling/master";

const initial: ActionState = { status: "idle" };

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Publishing is the one irreversible-feeling action in scheduling, so the
 * consequences are shown before the button, not after: exactly which projects
 * move, and for each one already on Master, the schedule it would replace.
 */
export function PushToMasterForm({
  variationId,
  preview,
}: {
  variationId: string;
  preview: PushPreview;
}) {
  const [state, formAction, isPending] = useActionState(pushToMasterAction, initial);
  const [scope, setScope] = useState<"ALL" | "SELECTED">("ALL");
  const [selected, setSelected] = useState<string[]>([]);

  // Visual preview — collapsed by default since it's a heavier render than
  // the table above and not everyone needs it every time. Reactive to the
  // same scope/selection controls rather than duplicating them.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<Zoom>("quarter");
  const [previewData, setPreviewData] = useState<Awaited<
    ReturnType<typeof loadMergedMasterPreview>
  > | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();

  const previewProjectIds = scope === "SELECTED" ? selected : undefined;
  useEffect(() => {
    // Render branches on scope/selected directly for the empty-selection
    // case (see JSX below), so there's nothing to fetch or clear here.
    if (!previewOpen) return;
    if (scope === "SELECTED" && selected.length === 0) return;
    startPreviewTransition(async () => {
      const data = await loadMergedMasterPreview({ variationId, projectIds: previewProjectIds });
      setPreviewData(data);
    });
    // previewProjectIds is derived fresh each render from scope/selected;
    // depending on those directly (rather than the array reference) is what
    // makes this re-fire only when the actual selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, variationId, scope, selected.join(",")]);

  // Location conflicts — unlike the visual preview above, this is a safety
  // check, not a heavy render, so it runs unconditionally (not gated behind
  // a disclosure) and stays current with whatever scope is selected.
  const [locationConflicts, setLocationConflicts] = useState<PushLocationConflictView[]>([]);
  const noSelection = scope === "SELECTED" && selected.length === 0;
  useEffect(() => {
    // Render checks noSelection directly (see JSX below) and an empty array
    // already renders nothing, so an empty selection needs no fetch and no
    // state to clear here.
    if (noSelection) return;
    let cancelled = false;
    previewPushConflictsAction({ variationId, projectIds: previewProjectIds }).then((rows) => {
      if (!cancelled) setLocationConflicts(rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationId, scope, selected.join(",")]);

  const replacing = preview.projects.filter((p) => p.conflictsWithExisting);
  const nothingToPush = preview.totalIncoming === 0;

  const affected =
    scope === "ALL" ? preview.projects : preview.projects.filter((p) => selected.includes(p.projectId));
  const affectedReplacing = affected.filter((p) => p.conflictsWithExisting);

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand/5 px-5 py-3">
        <div>
          <h2 className="font-semibold">Publish to Master Calendar</h2>
          <p className="text-sm text-muted-foreground">
            {nothingToPush
              ? "Nothing is scheduled in this variation yet."
              : `${preview.totalIncoming} placement${preview.totalIncoming === 1 ? "" : "s"} across ${preview.projects.length} project${preview.projects.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {replacing.length > 0 && (
          <Badge tone="warning">
            {replacing.length} project{replacing.length === 1 ? "" : "s"} already on Master
          </Badge>
        )}
      </div>

      {!nothingToPush && (
        <form action={formAction} className="space-y-4 p-5">
          <input type="hidden" name="variationId" value={variationId} />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">What would you like to publish?</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scopeChoice"
                  checked={scope === "ALL"}
                  onChange={() => setScope("ALL")}
                />
                Entire variation
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scopeChoice"
                  checked={scope === "SELECTED"}
                  onChange={() => setScope("SELECTED")}
                />
                Selected projects only
              </label>
            </div>
          </fieldset>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{scope === "SELECTED" ? "Publish" : ""} Project</th>
                  <th className="px-3 py-2 font-medium">New schedule</th>
                  <th className="px-3 py-2 font-medium">Currently on Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.projects.map((p) => (
                  <tr key={p.projectId}>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 font-medium">
                        {scope === "SELECTED" && (
                          <input
                            type="checkbox"
                            name="projectIds"
                            value={p.projectId}
                            checked={selected.includes(p.projectId)}
                            onChange={(e) =>
                              setSelected((s) =>
                                e.target.checked
                                  ? [...s, p.projectId]
                                  : s.filter((x) => x !== p.projectId)
                              )
                            }
                          />
                        )}
                        {p.projectName}
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      {fmt(p.incomingRange?.startDate ?? null)} – {fmt(p.incomingRange?.endDate ?? null)}
                      <span className="ml-1 text-xs text-muted-foreground">({p.incoming})</span>
                    </td>
                    <td className="px-3 py-2">
                      {p.conflictsWithExisting ? (
                        <span className="text-warning">
                          {fmt(p.existingRange?.startDate ?? null)} –{" "}
                          {fmt(p.existingRange?.endDate ?? null)}
                          <span className="ml-1 text-xs">(will be replaced)</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not scheduled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {affectedReplacing.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm">
              <p className="font-semibold text-warning">
                {affectedReplacing.length === 1
                  ? `${affectedReplacing[0].projectName} already has a schedule on the Master Calendar.`
                  : `${affectedReplacing.length} projects already have schedules on the Master Calendar.`}
              </p>
              <p className="mt-1 text-foreground">
                Publishing replaces the existing Master schedule for{" "}
                {affectedReplacing.length === 1 ? "it" : "them"}. Every other project on Master is
                left untouched, and the replaced schedule is kept in the publish history.
              </p>
            </div>
          )}

          {!noSelection && locationConflicts.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm">
              <p className="font-semibold text-warning">
                {locationConflicts.length === 1
                  ? "A location is double-booked."
                  : `${locationConflicts.length} locations are double-booked.`}
              </p>
              <ul className="mt-2 space-y-1.5 text-foreground">
                {locationConflicts.map((c, i) => (
                  <li key={i}>
                    <strong>{c.incomingProjectName}</strong> · {c.incomingLabel} wants{" "}
                    <strong>{c.locationName}</strong>, already booked by{" "}
                    {c.conflictsWith.map((x, j) => (
                      <span key={j}>
                        {j > 0 ? ", " : ""}
                        <strong>{x.projectName}</strong> · {x.label} ({fmt(new Date(x.startDate))} –{" "}
                        {fmt(new Date(x.endDate))})
                      </span>
                    ))}{" "}
                    on Master.
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                This doesn&apos;t block publishing — a shared location may be intentional. Worth
                double-checking before you do.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-muted"
            >
              <span>
                {previewOpen ? "Hide" : "Show"} visual preview
                <span className="ml-1.5 font-normal text-muted-foreground">
                  — what Master would look like across the calendar
                </span>
              </span>
              <span className={`text-xs text-muted-foreground transition-transform ${previewOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>

            {previewOpen && (
              <div className="border-t border-border p-4">
                {scope === "SELECTED" && selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Select at least one project above to preview it.
                  </p>
                ) : isPreviewPending && !previewData ? (
                  <p className="text-sm text-muted-foreground">Loading preview…</p>
                ) : previewData && previewData.assignments.length > 0 ? (
                  <TimelineGantt
                    variationId={variationId}
                    zoom={previewZoom}
                    windowStart={previewData.windowStart}
                    windowEnd={previewData.windowEnd}
                    assignments={previewData.assignments}
                    nonWorkingDays={previewData.nonWorkingDays}
                    onZoomChange={setPreviewZoom}
                    zoomLevels={["month", "quarter", "year"]}
                    periodLabel="Full merged range"
                    editable={false}
                    highlightIds={new Set(previewData.incomingIds)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="push-note">
              Note for the publish history (optional)
            </label>
            <Input id="push-note" name="note" placeholder="Why is this being published?" />
          </div>

          {state.status === "error" && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {scope === "SELECTED" && selected.length === 0 && (
              <span className="text-xs text-muted-foreground">Select at least one project.</span>
            )}
            <Button
              type="submit"
              disabled={isPending || (scope === "SELECTED" && selected.length === 0)}
            >
              {isPending ? "Publishing…" : "Publish to Master"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
