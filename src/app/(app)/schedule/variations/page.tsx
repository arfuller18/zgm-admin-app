import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { VARIATION_STATUS_LABEL, VARIATION_STATUS_TONE } from "@/lib/display";
import { loadSchedulingOverview, listSchedulableProjects } from "@/lib/scheduling/queries";
import { NewVariationForm } from "../new-variation-form";

// The picker grid for planning scenarios — split out from the Dashboard so
// "where do I go to work on a variation" has one obvious answer instead of
// competing with the Master summary and publish history for space.

export default async function VariationsPage() {
  await requireUser();
  const [{ master, variations }, allProjects] = await Promise.all([
    loadSchedulingOverview(),
    listSchedulableProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Variations</h1>
        <p className="mt-1 text-muted-foreground">
          Planning scenarios. Nothing here affects the Master Calendar until it&apos;s published.
        </p>
      </div>

      {variations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-8 text-center text-sm text-muted-foreground">
          No variations yet. Create one below to start planning without touching Master.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {variations.map((v) => (
            <li key={v.id}>
              <Link
                href={`/schedule/v/${v.id}`}
                className="block h-full rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{v.name}</span>
                  <Badge tone={VARIATION_STATUS_TONE[v.status]}>
                    {VARIATION_STATUS_LABEL[v.status]}
                  </Badge>
                </div>
                {v.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {v._count.assignments} placement{v._count.assignments === 1 ? "" : "s"}
                  {v.sourceVariation ? ` · from ${v.sourceVariation.name}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewVariationForm
        variations={variations.map((v) => ({
          id: v.id,
          name: v.name,
          includedProjectIds: v.includedProjectIds,
        }))}
        allProjects={allProjects}
        masterIncludedProjectIds={master?.includedProjectIds ?? []}
      />
    </div>
  );
}
