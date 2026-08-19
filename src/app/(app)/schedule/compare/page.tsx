import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getMasterVariation, listScheduleTargets } from "@/lib/scheduling/variations";
import { loadCalendarSectionData } from "../calendar-section";
import { CompareView } from "./compare-view";

// Two schedules, side by side. Reuses the exact same calendar (CalendarMonth)
// each single-schedule page uses — a comparison view earns its keep by being
// the same tool in two places, not a simplified read-only echo of it, so
// dragging, resizing, and the block popover all work here too, on either
// side.

export default async function CompareSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string; right?: string; month?: string }>;
}) {
  await requireUser();
  const { left, right, month } = await searchParams;

  const [targets, master] = await Promise.all([listScheduleTargets(), getMasterVariation()]);
  const isValidTarget = (id: string | undefined): id is string =>
    !!id && targets.some((t) => t.id === id);

  const leftId = isValidTarget(left) ? left : master.id;
  // Default the right side to the first schedule that isn't already on the
  // left — usually the most recently updated variation — so a first visit
  // shows something worth comparing rather than Master against itself.
  const rightId = isValidTarget(right)
    ? right
    : (targets.find((t) => t.id !== leftId)?.id ?? master.id);

  const [leftData, rightData] = await Promise.all([
    loadCalendarSectionData({ variationId: leftId, month }),
    loadCalendarSectionData({ variationId: rightId, month }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/schedule" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Scheduling
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Compare schedules</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Master or any variation, side by side.
        </p>
      </div>

      <CompareView targets={targets} leftId={leftId} rightId={rightId} left={leftData} right={rightData} />
    </div>
  );
}
