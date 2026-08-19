import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { getMasterVariation } from "@/lib/scheduling/variations";
import {
  loadWorkspace,
  flattenWorkspaceAssignments,
  listSchedulableProjects,
  unscheduledItems,
} from "@/lib/scheduling/queries";
import { listPublications } from "@/lib/scheduling/master";
import { ScheduleWorkspace } from "../workspace";
import { ShiftControls } from "../shift-modal";
import { TimelineSection } from "../timeline-section";
import { CalendarSection } from "../calendar-section";
import { ViewControls } from "../view-controls";
import { ManageProjects } from "../manage-projects";
import { ManageMaster } from "./manage-master";
import { UnscheduledDrawer } from "../unscheduled-drawer";

// The Master Calendar. Same planning surface underneath, deliberately
// different framing on top: this is the operational schedule, not a scenario.
// It has no delete, no rename, and it says plainly that edits here are live.

export default async function MasterCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    published?: string;
    view?: string;
    month?: string;
    project?: string;
    zoom?: string;
    anchor?: string;
  }>;
}) {
  await requireUser();
  const { published, view: rawView, month, project: projectId, zoom, anchor } = await searchParams;
  const view = rawView === "timeline" ? "timeline" : rawView === "list" ? "list" : "calendar";

  const master = await getMasterVariation();
  const [data, publications, allProjects] = await Promise.all([
    loadWorkspace(master.id),
    listPublications(5),
    listSchedulableProjects(),
  ]);
  const includedProjects = allProjects.filter((p) => master.includedProjectIds.includes(p.id));

  const placements = data.projects.reduce(
    (n, p) => n + p.schedulingRequirements.filter((r) => r.assignments.length > 0).length,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface">
          <div className="h-1.5 w-full bg-gradient-to-r from-brand to-accent" />
          <div className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Master Calendar</h1>
                <Badge tone="brand">Operational</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                What ZGM is actually doing. {placements} production
                {placements === 1 ? "" : "s"} scheduled. Edits made here are live immediately — the
                usual route is to plan in a variation and publish.
              </p>
            </div>
            <LinkButton href="/schedule" variant="outline">
              Plan in a variation
            </LinkButton>
          </div>
        </div>
      </div>

      {published && (
        <p className="rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-sm text-success">
          Published. The Master Calendar now reflects the new schedule.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ViewControls
          basePath="/schedule/master"
          view={view}
          month={month}
          projectId={projectId}
          projects={includedProjects}
        />
        <ManageProjects
          variationId={master.id}
          includedProjectIds={master.includedProjectIds}
          allProjects={allProjects}
        />
      </div>

      {view === "calendar" && (
        <div className="flex items-start gap-4">
          <UnscheduledDrawer items={unscheduledItems(data, master.includedProjectIds)} />
          <div className="min-w-0 flex-1">
            <CalendarSection variationId={master.id} month={month} projectId={projectId} />
          </div>
        </div>
      )}
      {view === "timeline" && (
        <TimelineSection
          variationId={master.id}
          zoomParam={zoom}
          anchorParam={anchor}
          projectId={projectId}
          basePath="/schedule/master"
        />
      )}

      {view === "list" && (
        <>
          <ShiftControls
            variationId={master.id}
            projects={includedProjects}
            assignments={flattenWorkspaceAssignments(data)}
          />
          <ScheduleWorkspace
            variationId={master.id}
            data={data}
            readOnlyNotice="Changes here take effect immediately"
          />
        </>
      )}

      <ManageMaster includedProjects={includedProjects} />

      {publications.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Publish history</h2>
          <p className="text-sm text-muted-foreground">
            Replaced schedules are retained here rather than discarded.
          </p>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {publications.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{p.sourceVariation?.name ?? "A deleted variation"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.assignmentsAdded} added
                    {p.assignmentsReplaced > 0 ? `, ${p.assignmentsReplaced} replaced` : ""}
                  </span>
                  {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.publishedAt).toLocaleString()}
                  {p.publishedBy?.name ? ` · ${p.publishedBy.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
