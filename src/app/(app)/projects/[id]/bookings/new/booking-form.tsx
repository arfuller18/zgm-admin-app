"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createBooking, type BookingFormState } from "./actions";

interface Option {
  id: string;
  label: string;
}

const initialState: BookingFormState = { status: "idle" };

export function BookingForm({
  projectId,
  unitProductions,
  people,
  locations,
  equipment,
}: {
  projectId: string;
  unitProductions: Option[];
  people: Option[];
  locations: Option[];
  equipment: Option[];
}) {
  const action = createBooking.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [resourceType, setResourceType] = useState<"PERSON" | "LOCATION" | "EQUIPMENT">(
    state.status !== "idle" ? state.values.resourceType : "PERSON"
  );

  const resourceOptions =
    resourceType === "PERSON" ? people : resourceType === "LOCATION" ? locations : equipment;
  const values = state.status !== "idle" ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label>Booking for</Label>
        <div className="flex gap-2">
          {(["PERSON", "LOCATION", "EQUIPMENT"] as const).map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setResourceType(rt)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                resourceType === rt
                  ? "border-brand bg-brand/10 text-brand-strong"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
              }`}
            >
              {rt === "PERSON" ? "Person" : rt === "LOCATION" ? "Location" : "Equipment"}
            </button>
          ))}
        </div>
        <input type="hidden" name="resourceType" value={resourceType} />
        {state.status === "conflict" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Booking for:{" "}
            <span className="font-medium text-foreground">
              {resourceOptions.find((o) => o.id === state.values.resourceId)?.label ??
                (state.values.newResourceName || "selected resource")}
            </span>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="resourceId">Existing {resourceType.toLowerCase()}</Label>
          <Select
            id="resourceId"
            name={state.status === "conflict" ? undefined : "resourceId"}
            disabled={state.status === "conflict"}
            defaultValue={values?.resourceId ?? ""}
          >
            <option value="">— none selected —</option>
            {resourceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="newResourceName">Or add a new one by name</Label>
          <Input
            id="newResourceName"
            name={state.status === "conflict" ? undefined : "newResourceName"}
            disabled={state.status === "conflict"}
            placeholder={`New ${resourceType.toLowerCase()} name`}
            defaultValue={values?.newResourceName}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="unitProductionId">Unit production (optional)</Label>
          <Select id="unitProductionId" name="unitProductionId" defaultValue={values?.unitProductionId ?? ""}>
            <option value="">— whole project —</option>
            {unitProductions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="roleOnProject">Role on this project</Label>
          <Input
            id="roleOnProject"
            name="roleOnProject"
            placeholder="e.g. Gaffer, Stage hold, Camera package"
            defaultValue={values?.roleOnProject}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={values?.startDate} />
        </div>
        <div>
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" required defaultValue={values?.endDate} />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={values?.notes} />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
      )}

      {state.status === "conflict" && (
        <div className="rounded-lg border border-warning/30 bg-warning-bg p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <Badge tone="warning">Conflict</Badge>
            This resource is already booked on another project during an overlapping window:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground">
            {state.conflicts.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface px-3 py-2">
                <span className="font-medium">{c.projectName}</span> ·{" "}
                {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                {c.roleOnProject ? ` · ${c.roleOnProject}` : ""}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" name="conflictAcknowledged" value="true" required />
            I understand the conflict and want to book this anyway
          </label>
          <input type="hidden" name="resourceId" value={state.values.resourceId} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Checking…" : state.status === "conflict" ? "Save anyway" : "Check & Save"}
        </Button>
      </div>
    </form>
  );
}
