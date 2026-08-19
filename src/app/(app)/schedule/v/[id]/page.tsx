import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { VARIATION_STATUS_LABEL, VARIATION_STATUS_TONE } from "@/lib/display";
import { getVariation } from "@/lib/scheduling/variations";
import {
  loadWorkspace,
  flattenWorkspaceAssignments,
  listSchedulableProjects,
  listActiveSchedulableProjects,
  unscheduledItems,
} from "@/lib/scheduling/queries";
import { previewPush } from "@/lib/scheduling/master";
import { ScheduleWorkspace } from "../../workspace";
import { ShiftControls } from "../../shift-modal";
import { TimelineSection } from "../../timeline-section";
import { CalendarSection } from "../../calendar-section";
import { ViewControls } from "../../view-controls";
import { ManageProjects } from "../../manage-projects";
import { UnscheduledDrawer } from "../../unscheduled-drawer";
import { PushToMasterForm } from "./push-form";
import { deleteVariationAction } from "../../actions";

export default async function VariationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; month?: string; project?: string; zoom?: string; anchor?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { view: rawView, month, project: projectId, zoom, anchor } = await searchParams;
  const view = rawView === "timeline" ? "timeline" : rawView === "list" ? "list" : "calendar";

  const variation = await getVariation(id);
  if (!variation) notFound();
  // Master has its own route with its own framing; it is never edited through
  // the variation workspace.
  if (variation.kind === "MASTER") redirect("/schedule/master");

  const [data, preview, allProjects, activeProjects] = await Promise.all([
    loadWorkspace(id),
    previewPush({ variationId: id }),
    listSchedulableProjects(),
    listActiveSchedulableProjects(),
  ]);
  const includedProjects = allProjects.filter((p) => variation.includedProjectIds.includes(p.id));
  const activeIncludedProjects = activeProjects.filter((p) =>
    variation.includedProjectIds.includes(p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{variation.name}</h1>
              <Badge tone={VARIATION_STATUS_TONE[variation.status]}>
                {VARIATION_STATUS_LABEL[variation.status]}
              </Badge>
              <Badge tone="info">Planning scenario</Badge>
            </div>
            {variation.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{variation.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing here affects live production dates until it is published to Master
              {variation.sourceVariation ? ` · copied from ${variation.sourceVariation.name}` : ""}
            </p>
          </div>

          <form action={deleteVariationAction}>
            <input type="hidden" name="variationId" value={variation.id} />
            <ConfirmSubmitButton
              type="submit"
              variant="ghost"
              size="sm"
              confirmMessage={`Delete "${variation.name}"? Its placements go with it. Requirements and productions are unaffected.`}
            >
              Delete variation
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <PushToMasterForm variationId={variation.id} preview={preview} />

      <div className="flex flex-wrap items-center gap-3">
        <ViewControls
          basePath={`/schedule/v/${variation.id}`}
          view={view}
          month={month}
          projectId={projectId}
          projects={includedProjects}
        />
        <ManageProjects
          variationId={variation.id}
          includedProjectIds={variation.includedProjectIds}
          allProjects={allProjects}
        />
      </div>

      {view === "calendar" && (
        <>
          <ShiftControls
            variationId={variation.id}
            projects={activeIncludedProjects}
            assignments={flattenWorkspaceAssignments(data)}
          />
          <div className="flex items-start gap-4">
            <UnscheduledDrawer items={unscheduledItems(data, variation.includedProjectIds)} />
            <div className="min-w-0 flex-1">
              <CalendarSection variationId={variation.id} month={month} projectId={projectId} />
            </div>
          </div>
        </>
      )}
      {view === "timeline" && (
        <TimelineSection
          variationId={variation.id}
          zoomParam={zoom}
          anchorParam={anchor}
          projectId={projectId}
          basePath={`/schedule/v/${variation.id}`}
        />
      )}

      {view === "list" && <ScheduleWorkspace variationId={variation.id} data={data} />}
    </div>
  );
}
