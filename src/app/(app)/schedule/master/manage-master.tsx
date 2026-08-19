"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { removeProjectFromMasterAction, clearMasterAction, type ActionState } from "../actions";

const initial: ActionState = { status: "idle" };

// Removing a project (or clearing everything) is soft, same as unassign()
// everywhere else in this codebase: placements are unscheduled, requirements
// return to "unscheduled," and nothing is deleted — replan in a variation
// and publish to bring it back. That's what the confirm copy says outright,
// since this acts on the live schedule and the stakes should read that way
// even though the action itself is fully reversible.

function RemoveProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [state, formAction, isPending] = useActionState(removeProjectFromMasterAction, initial);
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <ConfirmSubmitButton
        type="submit"
        variant="danger"
        size="sm"
        disabled={isPending}
        confirmMessage={`Remove ${projectName} from the Master Calendar?\n\nIts placements are unscheduled — the project's requirements return to "unscheduled" and can be replanned and republished anytime. Nothing is deleted.`}
      >
        {isPending ? "Removing…" : "Remove"}
      </ConfirmSubmitButton>
      {state.status === "error" && (
        <p className="mt-1 text-xs text-danger">{state.message}</p>
      )}
    </form>
  );
}

function ClearMasterButton() {
  const [state, formAction, isPending] = useActionState(clearMasterAction, initial);
  return (
    <form action={formAction}>
      <ConfirmSubmitButton
        type="submit"
        variant="danger"
        disabled={isPending}
        confirmMessage={`Clear the Master Calendar entirely?\n\nEvery placement across every project is unscheduled — requirements return to "unscheduled" and nothing is deleted. This is the live production schedule; only do this if you mean it. Replan in a variation and publish to bring any of it back.`}
      >
        {isPending ? "Clearing…" : "Clear Master entirely"}
      </ConfirmSubmitButton>
      {state.status === "error" && (
        <p className="mt-1 text-xs text-danger">{state.message}</p>
      )}
    </form>
  );
}

export function ManageMaster({
  includedProjects,
}: {
  includedProjects: { id: string; name: string }[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Manage Master Calendar</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Removing a project — or clearing everything — only unschedules it. Nothing is deleted, and
        it can be replanned and republished anytime.
      </p>

      {includedProjects.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing is scheduled on Master right now.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {includedProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-medium">{p.name}</span>
                <RemoveProjectButton projectId={p.id} projectName={p.name} />
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4">
            <ClearMasterButton />
          </div>
        </>
      )}
    </section>
  );
}
