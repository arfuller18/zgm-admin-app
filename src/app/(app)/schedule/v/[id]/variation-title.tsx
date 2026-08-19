"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameVariationAction } from "../../actions";

// Click the name to rename in place — no separate settings page for
// something this small. description is carried through unchanged on every
// save since this control only ever edits the name; renameVariationAction
// requires it explicitly for exactly that reason.
export function VariationTitle({
  variationId,
  name,
  description,
}: {
  variationId: string;
  name: string;
  description: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    startTransition(async () => {
      const result = await renameVariationAction({ variationId, name: trimmed, description });
      if (result.ok) {
        setError(null);
        setIsEditing(false);
      } else {
        setError(result.message);
      }
    });
  }

  function cancel() {
    setDraft(name);
    setError(null);
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setIsEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 text-left"
        title="Rename this variation"
      >
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <span className="text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          ✎
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            cancel();
          }
        }}
        autoFocus
        disabled={isPending}
        className="!w-64 text-lg font-bold"
        aria-label="Variation name"
      />
      <Button type="button" size="sm" disabled={isPending} onClick={save}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={cancel}>
        Cancel
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
