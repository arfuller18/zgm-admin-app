import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_COLOR_HEX, REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_TONE } from "@/lib/display";
import { formatScheduleDate } from "@/lib/scheduling/work-calendar";
import { requirementLabel, type WorkspaceData } from "@/lib/scheduling/queries";
import {
  assignAction,
  moveAssignmentAction,
  resizeAssignmentAction,
  unassignAction,
} from "./actions";

// The planning surface, shared by the Master Calendar and every variation.
// Deliberately form-driven rather than drag-driven: precise date entry has to
// work on its own, both for accessibility and because dragging is a poor way
// to hit an exact date. Drag-and-drop lands on top of this, not instead of it.

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC", // schedule dates are UTC-midnight; local would shift them a day
  });
}

export function ScheduleWorkspace({
  variationId,
  data,
  readOnlyNotice,
}: {
  variationId: string;
  data: WorkspaceData;
  readOnlyNotice?: string;
}) {
  const { projects } = data;

  const totalRequirements = projects.reduce((n, p) => n + p.schedulingRequirements.length, 0);
  const placed = projects.reduce(
    (n, p) => n + p.schedulingRequirements.filter((r) => r.assignments.length > 0).length,
    0
  );

  if (totalRequirements === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-10 text-center">
        <p className="font-medium text-foreground">No scheduling requirements yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Requirements are defined per project — open a project and add what it needs scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-medium">
          {placed} of {totalRequirements} requirements placed
        </span>
        {readOnlyNotice && <span className="text-muted-foreground">{readOnlyNotice}</span>}
      </div>

      {projects.map((project) => {
        const accent = project.projectColor ? PROJECT_COLOR_HEX[project.projectColor] : "#7c3aed";
        const units = project.schedulingRequirements.filter((r) => r.kind === "UNIT_PRODUCTION");
        const events = project.schedulingRequirements.filter((r) => r.kind === "PRODUCTION_EVENT");

        return (
          // <details> gives collapsing per project with no client JS — which
          // matters when ZGM has a dozen productions running at once.
          <details
            key={project.id}
            open
            className="overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-muted">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
              <span className="font-semibold">{project.name}</span>
              <span className="text-xs text-muted-foreground">
                {project.schedulingRequirements.filter((r) => r.assignments.length > 0).length}/
                {project.schedulingRequirements.length} placed
              </span>
            </summary>

            <div className="border-t border-border">
              {units.length > 0 && (
                <RequirementGroup
                  title="Unit Productions"
                  requirements={units}
                  variationId={variationId}
                />
              )}
              {events.length > 0 && (
                <RequirementGroup
                  title="Production Events"
                  requirements={events}
                  variationId={variationId}
                />
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function RequirementGroup({
  title,
  requirements,
  variationId,
}: {
  title: string;
  requirements: WorkspaceData["projects"][number]["schedulingRequirements"];
  variationId: string;
}) {
  return (
    <div>
      <h3 className="bg-surface-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="divide-y divide-border">
        {requirements.map((r) => (
          <RequirementRow key={r.id} requirement={r} variationId={variationId} />
        ))}
      </ul>
    </div>
  );
}

function RequirementRow({
  requirement: r,
  variationId,
}: {
  requirement: WorkspaceData["projects"][number]["schedulingRequirements"][number];
  variationId: string;
}) {
  const isPlaced = r.assignments.length > 0;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Placed items stay in the list, marked — not hidden. Seeing what
                is already scheduled is half the value of the list. */}
            <span
              aria-hidden
              className={isPlaced ? "text-success" : "text-muted-foreground"}
              title={isPlaced ? "Scheduled" : "Not yet scheduled"}
            >
              {isPlaced ? "✓" : "○"}
            </span>
            <span className="font-medium">{requirementLabel(r)}</span>
            <Badge tone={REQUIREMENT_STATUS_TONE[r.status]}>
              {REQUIREMENT_STATUS_LABEL[r.status]}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Requires {r.durationDays} production {r.durationDays === 1 ? "day" : "days"}
          </p>
        </div>

        {!isPlaced && (
          // No fake date for something unscheduled — the field starts empty.
          <form action={assignAction} className="flex shrink-0 items-end gap-2">
            <input type="hidden" name="variationId" value={variationId} />
            <input type="hidden" name="requirementId" value={r.id} />
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor={`start-${r.id}`}>
                Start date
              </label>
              <Input id={`start-${r.id}`} name="startDate" type="date" required className="!w-40" />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Schedule
            </Button>
          </form>
        )}
      </div>

      {r.assignments.map((a) => (
        <div
          key={a.id}
          className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-2"
        >
          <div className="mr-auto text-sm">
            <span className="font-medium">{fmt(a.startDate)}</span>
            <span className="text-muted-foreground"> → {fmt(a.endDate)}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {a.durationDays} production {a.durationDays === 1 ? "day" : "days"}
            </span>
          </div>

          <form action={moveAssignmentAction} className="flex items-end gap-1.5">
            <input type="hidden" name="assignmentId" value={a.id} />
            <input type="hidden" name="variationId" value={variationId} />
            <Input
              name="startDate"
              type="date"
              defaultValue={formatScheduleDate(new Date(a.startDate))}
              className="!w-36"
              aria-label="Move to start date"
            />
            <Button type="submit" size="sm" variant="ghost">
              Move
            </Button>
          </form>

          <form action={resizeAssignmentAction} className="flex items-end gap-1.5">
            <input type="hidden" name="assignmentId" value={a.id} />
            <input type="hidden" name="variationId" value={variationId} />
            <Input
              name="durationDays"
              type="number"
              min={1}
              defaultValue={a.durationDays}
              className="!w-20"
              aria-label="Duration in production days"
            />
            <Button type="submit" size="sm" variant="ghost">
              Resize
            </Button>
          </form>

          <form action={unassignAction}>
            <input type="hidden" name="assignmentId" value={a.id} />
            <input type="hidden" name="variationId" value={variationId} />
            {/* Unscheduling removes the placement only — the requirement and
                the production itself survive and can be placed again. */}
            <Button type="submit" size="sm" variant="ghost" title="Remove from this schedule">
              Unschedule
            </Button>
          </form>
        </div>
      ))}
    </li>
  );
}
