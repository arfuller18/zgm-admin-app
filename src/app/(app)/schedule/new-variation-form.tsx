"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createVariationAction, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

interface VariationOption {
  id: string;
  name: string;
  includedProjectIds: string[];
}

type Mode = "BLANK" | "DUPLICATE" | "COPY_MASTER";

function defaultSelection(
  mode: Mode,
  sourceId: string,
  variations: VariationOption[],
  masterIncludedProjectIds: string[]
): string[] {
  if (mode === "COPY_MASTER") return masterIncludedProjectIds;
  if (mode === "DUPLICATE") return variations.find((v) => v.id === sourceId)?.includedProjectIds ?? [];
  return [];
}

/**
 * Uncontrolled on purpose: remounting via `key` when mode/source changes is
 * what gives a fresh default selection without an effect fighting the user's
 * own checkbox edits in between remounts.
 */
function ProjectPicker({
  allProjects,
  defaultSelected,
}: {
  allProjects: { id: string; name: string }[];
  defaultSelected: string[];
}) {
  if (allProjects.length === 0) {
    return <p className="text-sm text-muted-foreground">No projects to choose from yet.</p>;
  }
  return (
    <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2.5">
      {allProjects.map((p) => (
        <label
          key={p.id}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium has-[:checked]:bg-brand has-[:checked]:text-brand-foreground hover:bg-border"
        >
          <input
            type="checkbox"
            name="includedProjectIds"
            value={p.id}
            className="sr-only"
            defaultChecked={defaultSelected.includes(p.id)}
          />
          {p.name}
        </label>
      ))}
    </div>
  );
}

export function NewVariationForm({
  variations,
  allProjects,
  masterIncludedProjectIds,
}: {
  variations: VariationOption[];
  allProjects: { id: string; name: string }[];
  masterIncludedProjectIds: string[];
}) {
  const [state, formAction, isPending] = useActionState(createVariationAction, initial);
  const [mode, setMode] = useState<Mode>("BLANK");
  const [sourceId, setSourceId] = useState("");

  return (
    <details className="rounded-2xl border border-dashed border-border bg-surface-muted/30">
      <summary className="cursor-pointer list-none px-5 py-3 font-medium hover:bg-surface-muted">
        + New schedule variation
      </summary>

      <form action={formAction} className="space-y-4 border-t border-border p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="v-name">Name</Label>
            <Input id="v-name" name="name" required placeholder="e.g. 2027 Slate — Aggressive" />
          </div>
          <div>
            <Label htmlFor="v-mode">Start from</Label>
            <Select
              id="v-mode"
              name="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="BLANK">Blank — nothing scheduled</option>
              <option value="COPY_MASTER">A copy of the Master Calendar</option>
              <option value="DUPLICATE">A copy of another variation</option>
            </Select>
          </div>
        </div>

        {mode === "DUPLICATE" && (
          <div>
            <Label htmlFor="v-source">Variation to copy</Label>
            <Select
              id="v-source"
              name="sourceVariationId"
              required
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="" disabled>
                Choose a variation…
              </option>
              {variations.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            Which projects does this schedule cover?
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">
            Only these show up in the filters and the unscheduled-events drawer once it&apos;s
            created — you can add or remove projects from that list anytime after.
          </p>
          <ProjectPicker
            key={`${mode}:${sourceId}`}
            allProjects={allProjects}
            defaultSelected={defaultSelection(mode, sourceId, variations, masterIncludedProjectIds)}
          />
        </fieldset>

        <div>
          <Label htmlFor="v-desc">Description (optional)</Label>
          <Textarea id="v-desc" name="description" placeholder="What is this scenario testing?" />
        </div>

        {state.status === "error" && (
          <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Copying leaves the source untouched — a variation is a scenario, never a duplicate of the
          productions themselves.
        </p>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create variation"}
          </Button>
        </div>
      </form>
    </details>
  );
}
