"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { updateUnitProduction, type UnitFormState } from "./actions";
import type { UnitProduction } from "../../../../../../../generated/prisma/client";

const initialState: UnitFormState = { status: "idle" };

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function UnitEditForm({
  projectId,
  unit,
  people,
}: {
  projectId: string;
  unit: UnitProduction;
  people: { id: string; fullName: string }[];
}) {
  const action = updateUnitProduction.bind(null, projectId, unit.id);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Unit Production</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={unit.name} />
          </div>
          <div>
            <Label htmlFor="season">Season</Label>
            <Input id="season" name="season" type="number" defaultValue={unit.season ?? ""} />
          </div>
          <div>
            <Label htmlFor="episode">Episode</Label>
            <Input id="episode" name="episode" type="number" defaultValue={unit.episode ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="episodeTitle">Episode title</Label>
            <Input id="episodeTitle" name="episodeTitle" defaultValue={unit.episodeTitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="scriptStatus">Script status</Label>
            <Input id="scriptStatus" name="scriptStatus" defaultValue={unit.scriptStatus ?? ""} />
          </div>
          <div>
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input id="duration" name="duration" type="number" defaultValue={unit.duration ?? ""} />
          </div>
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(unit.startDate)} />
          </div>
          <div>
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={toDateInput(unit.endDate)} />
          </div>
          <div>
            <Label htmlFor="directorId">Director</Label>
            <Select id="directorId" name="directorId" defaultValue={unit.directorId ?? ""}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="writerId">Writer</Label>
            <Select id="writerId" name="writerId" defaultValue={unit.writerId ?? ""}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bookedBy">Booked by</Label>
            <Input id="bookedBy" name="bookedBy" defaultValue={unit.bookedBy ?? ""} />
          </div>
          <div>
            <Label htmlFor="bookingWindow">Booking window</Label>
            <Input id="bookingWindow" name="bookingWindow" defaultValue={unit.bookingWindow ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={unit.notes ?? ""} />
          </div>
        </div>
      </section>

      {state.status === "error" && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
