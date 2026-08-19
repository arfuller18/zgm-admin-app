"use client";

import { useActionState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  PROJECT_FORMAT_LABEL,
  PROJECT_STATUS_LABEL,
  PRIORITY_LABEL,
  PROJECT_COLOR_LABEL,
} from "@/lib/display";
import { updateProject, type ProjectFormState } from "../actions";
import type { Project } from "../../../../../../generated/prisma/client";

const initialState: ProjectFormState = { status: "idle" };

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function ProjectEditForm({ project }: { project: Project }) {
  const action = updateProject.bind(null, project.id);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Basics">
        <Field label="Project name" htmlFor="name" full>
          <Input id="name" name="name" required defaultValue={project.name} />
        </Field>
        <Field label="Project ID" htmlFor="projectCode">
          <Input id="projectCode" name="projectCode" defaultValue={project.projectCode ?? ""} />
        </Field>
        <Field label="Format" htmlFor="format">
          <Select id="format" name="format" defaultValue={project.format ?? ""}>
            <option value="">—</option>
            {Object.entries(PROJECT_FORMAT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Genre" htmlFor="genre">
          <Input id="genre" name="genre" defaultValue={project.genre ?? ""} />
        </Field>
        <Field label="Project color" htmlFor="projectColor">
          <Select id="projectColor" name="projectColor" defaultValue={project.projectColor ?? ""}>
            <option value="">—</option>
            {Object.entries(PROJECT_COLOR_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Season / Film" htmlFor="seasonFilm">
          <Input id="seasonFilm" name="seasonFilm" defaultValue={project.seasonFilm ?? ""} />
        </Field>
        <Field label="Episode count" htmlFor="episodeCount">
          <Input
            id="episodeCount"
            name="episodeCount"
            type="number"
            min={0}
            defaultValue={project.episodeCount ?? ""}
          />
        </Field>
        <Field label="Episode length (minutes)" htmlFor="episodeLength">
          <Input
            id="episodeLength"
            name="episodeLength"
            type="number"
            min={0}
            defaultValue={project.episodeLength ?? ""}
          />
        </Field>
      </Section>

      <Section title="Status & Priority">
        <Field label="Current status" htmlFor="currentStatus">
          <Select id="currentStatus" name="currentStatus" defaultValue={project.currentStatus ?? ""}>
            <option value="">—</option>
            {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={project.priority ?? ""}>
            <option value="">—</option>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rights status" htmlFor="rightsStatus">
          <Input id="rightsStatus" name="rightsStatus" defaultValue={project.rightsStatus ?? ""} />
        </Field>
        <Field label="Rights expiration" htmlFor="rightsExpiration">
          <Input
            id="rightsExpiration"
            name="rightsExpiration"
            type="date"
            defaultValue={toDateInput(project.rightsExpiration)}
          />
        </Field>
        <Field label="Script status" htmlFor="scriptStatus">
          <Input id="scriptStatus" name="scriptStatus" defaultValue={project.scriptStatus ?? ""} />
        </Field>
        <Field label="Sales / distribution status" htmlFor="salesDistributionStatus">
          <Input
            id="salesDistributionStatus"
            name="salesDistributionStatus"
            defaultValue={project.salesDistributionStatus ?? ""}
          />
        </Field>
        <Field label="Sales / distribution notes" htmlFor="salesDistributionNotes" full>
          <Textarea
            id="salesDistributionNotes"
            name="salesDistributionNotes"
            defaultValue={project.salesDistributionNotes ?? ""}
          />
        </Field>
      </Section>

      <Section title="Casting & Documents">
        <Field label="Casting status" htmlFor="castingStatus">
          <Input id="castingStatus" name="castingStatus" defaultValue={project.castingStatus ?? ""} />
        </Field>
        <Field label="Casting director" htmlFor="castingDirector">
          <Input id="castingDirector" name="castingDirector" defaultValue={project.castingDirector ?? ""} />
        </Field>
        <Field label="Google Folder link" htmlFor="googleFolderUrl">
          <Input id="googleFolderUrl" name="googleFolderUrl" type="url" defaultValue={project.googleFolderUrl ?? ""} />
        </Field>
        <Field label="Decks & Bibles link" htmlFor="decksBiblesUrl">
          <Input id="decksBiblesUrl" name="decksBiblesUrl" type="url" defaultValue={project.decksBiblesUrl ?? ""} />
        </Field>
        <Field label="Additional links" htmlFor="additionalLinks" full>
          <Input id="additionalLinks" name="additionalLinks" type="url" defaultValue={project.additionalLinks ?? ""} />
        </Field>
      </Section>

      <Section title="Creative">
        <Field label="Logline" htmlFor="logline" full>
          <Textarea id="logline" name="logline" defaultValue={project.logline ?? ""} />
        </Field>
        <Field label="Why ZGM / Creative value" htmlFor="whyZgm" full>
          <Textarea id="whyZgm" name="whyZgm" defaultValue={project.whyZgm ?? ""} />
        </Field>
        <Field label="Audience / Marketing hook" htmlFor="audienceHook" full>
          <Textarea id="audienceHook" name="audienceHook" defaultValue={project.audienceHook ?? ""} />
        </Field>
        <Field label="Biggest risk" htmlFor="biggestRisk" full>
          <Textarea id="biggestRisk" name="biggestRisk" defaultValue={project.biggestRisk ?? ""} />
        </Field>
      </Section>

      <Section title="What's Next">
        <Field label="Next decision" htmlFor="nextDecision">
          <Input id="nextDecision" name="nextDecision" defaultValue={project.nextDecision ?? ""} />
        </Field>
        <Field label="Next action" htmlFor="nextAction">
          <Input id="nextAction" name="nextAction" defaultValue={project.nextAction ?? ""} />
        </Field>
        <Field label="Next action due date" htmlFor="nextActionDueDate">
          <Input
            id="nextActionDueDate"
            name="nextActionDueDate"
            type="date"
            defaultValue={toDateInput(project.nextActionDueDate)}
          />
        </Field>
      </Section>

      <Section title="Notes & Ownership">
        <Field label="Tax credit / location notes" htmlFor="taxCreditNotes" full>
          <Textarea id="taxCreditNotes" name="taxCreditNotes" defaultValue={project.taxCreditNotes ?? ""} />
        </Field>
        <Field label="Additional notes" htmlFor="additionalNotes" full>
          <Textarea id="additionalNotes" name="additionalNotes" defaultValue={project.additionalNotes ?? ""} />
        </Field>
        <Field label="ZGM owner" htmlFor="zgmOwner">
          <Input id="zgmOwner" name="zgmOwner" defaultValue={project.zgmOwner ?? ""} />
        </Field>
        <Field label="Main contact role" htmlFor="mainContactRole">
          <Input id="mainContactRole" name="mainContactRole" defaultValue={project.mainContactRole ?? ""} />
        </Field>
      </Section>

      {state.status === "error" && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.message}</p>
      )}

      <div className="flex justify-end gap-2">
        <LinkButton href={`/projects/${project.id}`} variant="outline">
          Cancel
        </LinkButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
