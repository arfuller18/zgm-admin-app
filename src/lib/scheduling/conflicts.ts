// Location conflicts between concurrently-scheduled productions.
//
// ZGM runs several shows at once by design — calendar-month.tsx lane-packs
// overlapping bars because overlap in *time* is the normal case, not an
// error. But two productions wanting the same physical *location* on
// overlapping days is worth a scheduler's attention. This mirrors
// src/lib/conflicts.ts (the People/Location/Equipment Booking system) in
// spirit: a warning surfaced at the point of the mutation, never a hard
// block. A scheduler may mean it — a shared backlot on different call
// times, a location swap mid-negotiation — and the call is theirs, same as
// the "I understand the conflict and want to book this anyway" pattern the
// Booking form already uses.

import { prisma } from "../prisma";
import { requirementLabel } from "./queries";

export interface ScheduleLocationConflict {
  assignmentId: string;
  projectId: string;
  projectName: string;
  label: string;
  locationName: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Other placements at the same location, in the same schedule, whose dates
 * overlap. Excludes the assignment being checked (so moving a block doesn't
 * conflict with its own prior position) and, if given, its own project (two
 * units of the same show sharing a base is not a conflict).
 */
export async function findLocationConflicts(input: {
  variationId: string;
  locationId: string;
  startDate: Date;
  endDate: Date;
  excludeAssignmentId?: string;
  excludeProjectId?: string;
}): Promise<ScheduleLocationConflict[]> {
  const rows = await prisma.scheduleAssignment.findMany({
    where: {
      variationId: input.variationId,
      locationId: input.locationId,
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
      ...(input.excludeAssignmentId ? { id: { not: input.excludeAssignmentId } } : {}),
      ...(input.excludeProjectId ? { projectId: { not: input.excludeProjectId } } : {}),
    },
    include: {
      project: { select: { name: true } },
      location: { select: { name: true } },
      requirement: {
        include: { unitProduction: { select: { name: true } }, eventType: { select: { name: true } } },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return rows.map((r) => ({
    assignmentId: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    label: requirementLabel(r.requirement),
    locationName: r.location?.name ?? "Unknown location",
    startDate: r.startDate,
    endDate: r.endDate,
  }));
}
