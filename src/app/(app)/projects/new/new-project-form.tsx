"use client";

import { useActionState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PROJECT_FORMAT_LABEL, PROJECT_STATUS_LABEL } from "@/lib/display";
import { createProject, type NewProjectFormState } from "../actions";

const initialState: NewProjectFormState = { status: "idle" };

export function NewProjectForm() {
  const [state, formAction, isPending] = useActionState(createProject, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required autoFocus placeholder="e.g. New Series Idea" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="format">Format</Label>
          <Select id="format" name="format" defaultValue="">
            <option value="">—</option>
            {Object.entries(PROJECT_FORMAT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="currentStatus">Starting status</Label>
          <Select id="currentStatus" name="currentStatus" defaultValue="IDEA">
            {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
      )}

      <p className="text-sm text-muted-foreground">
        You&apos;ll land on the full edit page next to fill in everything else.
      </p>

      <div className="flex justify-end gap-2">
        <LinkButton href="/projects" variant="outline">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
