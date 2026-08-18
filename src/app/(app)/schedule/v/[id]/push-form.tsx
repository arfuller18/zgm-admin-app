"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { pushToMasterAction, type ActionState } from "../../actions";
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
