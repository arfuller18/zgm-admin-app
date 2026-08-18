"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createVariationAction, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

export function NewVariationForm({ variations }: { variations: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(createVariationAction, initial);
  const [mode, setMode] = useState<"BLANK" | "DUPLICATE" | "COPY_MASTER">("BLANK");

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
              onChange={(e) => setMode(e.target.value as typeof mode)}
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
            <Select id="v-source" name="sourceVariationId" required defaultValue="">
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
