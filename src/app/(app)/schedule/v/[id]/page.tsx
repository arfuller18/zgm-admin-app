import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { VARIATION_STATUS_LABEL, VARIATION_STATUS_TONE } from "@/lib/display";
import { getVariation } from "@/lib/scheduling/variations";
import { loadWorkspace } from "@/lib/scheduling/queries";
import { previewPush } from "@/lib/scheduling/master";
import { ScheduleWorkspace, ShiftControls } from "../../workspace";
import { ScheduleTimeline } from "../../schedule-timeline";
import { PushToMasterForm } from "./push-form";
import { deleteVariationAction } from "../../actions";

export default async function VariationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const variation = await getVariation(id);
  if (!variation) notFound();
  // Master has its own route with its own framing; it is never edited through
  // the variation workspace.
  if (variation.kind === "MASTER") redirect("/schedule/master");

  const [data, preview] = await Promise.all([loadWorkspace(id), previewPush({ variationId: id })]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/schedule" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Scheduling
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Production timeline</h2>
        <ScheduleTimeline variationId={variation.id} />
      </section>

      <ShiftControls
        variationId={variation.id}
        projects={data.projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      <ScheduleWorkspace variationId={variation.id} data={data} />
    </div>
  );
}
