// Placing requirements onto dates, within one variation.
//
// Every date calculation here delegates to work-calendar.ts. Nothing in this
// file does its own day arithmetic.

import { prisma } from "../prisma";
import { SchedulingError } from "./variations";
import * as variations from "./variations";
import { syncRequirementStatus } from "./requirements";
import { loadWorkCalendarContext } from "./context";
import {
  normalizeScheduleDate,
  resolveEndDate,
  countProductionDays,
  shiftBlock,
  type ShiftUnit,
} from "./work-calendar";

/** Place a requirement on a date. The end date follows from its duration. */
export async function assign(input: {
  variationId: string;
  requirementId: string;
  startDate: Date;
  durationDays?: number;
  locationId?: string | null;
  notes?: string | null;
}) {
  const requirement = await prisma.schedulingRequirement.findUnique({
    where: { id: input.requirementId },
    select: { id: true, projectId: true, durationDays: true },
  });
  if (!requirement) throw new SchedulingError("Requirement not found.");

  const duration = input.durationDays ?? requirement.durationDays;
  const ctx = await loadWorkCalendarContext(input.variationId);
  const startDate = normalizeScheduleDate(input.startDate);
  const endDate = resolveEndDate(startDate, duration, ctx, requirement.projectId);

  const assignment = await prisma.scheduleAssignment.create({
    data: {
      variationId: input.variationId,
      requirementId: requirement.id,
      projectId: requirement.projectId,
      startDate,
      endDate,
      durationDays: duration,
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
    },
  });

  await syncRequirementStatus(requirement.id);
  return assignment;
}

/** Move a placement, preserving how many production days it spans. */
export async function move(assignmentId: string, newStartDate: Date) {
  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new SchedulingError("Assignment not found.");

  const ctx = await loadWorkCalendarContext(assignment.variationId);
  const startDate = normalizeScheduleDate(newStartDate);
  const endDate = resolveEndDate(startDate, assignment.durationDays, ctx, assignment.projectId);

  return prisma.scheduleAssignment.update({
    where: { id: assignmentId },
    data: { startDate, endDate },
  });
}

/**
 * Change how long a placement runs.
 *
 * This updates the *assignment*, not the requirement. Resizing a block in one
 * scenario must not silently change what the project needs, or what any other
 * scenario shows — variation isolation is the point of the whole model. Use
 * `applyDurationToRequirement` to promote the new length into the stated need.
 */
export async function resize(assignmentId: string, newDurationDays: number) {
  if (newDurationDays < 1) throw new SchedulingError("Duration must be at least one day.");

  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new SchedulingError("Assignment not found.");

  const ctx = await loadWorkCalendarContext(assignment.variationId);
  const endDate = resolveEndDate(assignment.startDate, newDurationDays, ctx, assignment.projectId);

  return prisma.scheduleAssignment.update({
    where: { id: assignmentId },
    data: { durationDays: newDurationDays, endDate },
  });
}

/** Resize by dragging an edge to a date rather than typing a duration. */
export async function resizeToEndDate(assignmentId: string, newEndDate: Date) {
  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new SchedulingError("Assignment not found.");

  const ctx = await loadWorkCalendarContext(assignment.variationId);
  const end = normalizeScheduleDate(newEndDate);
  if (end < assignment.startDate) {
    throw new SchedulingError("An event cannot end before it starts.");
  }
  const durationDays = Math.max(
    countProductionDays(assignment.startDate, end, ctx, assignment.projectId),
    1
  );
  return resize(assignmentId, durationDays);
}

/**
 * Resize by dragging the *leading* edge: the block's end stays put and its
 * start moves, so the duration absorbs the change. Distinct from `move`,
 * which drags the whole block and keeps the duration.
 */
export async function resizeToStartDate(assignmentId: string, newStartDate: Date) {
  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new SchedulingError("Assignment not found.");

  const ctx = await loadWorkCalendarContext(assignment.variationId);
  const start = normalizeScheduleDate(newStartDate);
  if (start > assignment.endDate) {
    throw new SchedulingError("An event cannot start after it ends.");
  }
  const durationDays = Math.max(
    countProductionDays(start, assignment.endDate, ctx, assignment.projectId),
    1
  );
  // Re-derive the end rather than keeping the old one: if the dragged-to end
  // sat on a weekend, the honest end is the last production day, not the
  // date the cursor happened to land on.
  const endDate = resolveEndDate(start, durationDays, ctx, assignment.projectId);

  return prisma.scheduleAssignment.update({
    where: { id: assignmentId },
    data: { startDate: start, durationDays, endDate },
  });
}

/** Promote an assignment's length into the requirement's stated need. */
export async function applyDurationToRequirement(assignmentId: string) {
  const assignment = await prisma.scheduleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new SchedulingError("Assignment not found.");
  return prisma.schedulingRequirement.update({
    where: { id: assignment.requirementId },
    data: { durationDays: assignment.durationDays },
  });
}

/**
 * Remove a placement. The requirement survives and returns to unscheduled —
 * it stays available to place again, which is the difference between
 * unscheduling and deleting.
 */
export async function unassign(assignmentId: string) {
  const assignment = await prisma.scheduleAssignment.findUnique({
    where: { id: assignmentId },
    select: { requirementId: true },
  });
  if (!assignment) throw new SchedulingError("Assignment not found.");

  await prisma.scheduleAssignment.delete({ where: { id: assignmentId } });
  await syncRequirementStatus(assignment.requirementId);
}

// ---------------------------------------------------------------------------
// Bulk removal — "take this project off Master" / "start this schedule over"
//
// Soft, same as unassign(): every placement in scope is removed, but nothing
// is deleted. Requirements return to unscheduled and stay available to place
// again — the difference between clearing a schedule and destroying it. For
// Master specifically that matters even more: this is the live production
// calendar, and "clear" must mean "nothing is happening right now," not
// "the plan for it is gone."
// ---------------------------------------------------------------------------

/**
 * Unschedule every placement one project has in a variation, and drop that
 * project from the variation's included-projects scope. Requirements return
 * to unscheduled; nothing about the project or its productions is touched.
 */
export async function removeProjectFromVariation(variationId: string, projectId: string) {
  const rows = await prisma.scheduleAssignment.findMany({
    where: { variationId, projectId },
    select: { id: true },
  });
  for (const row of rows) {
    await unassign(row.id);
  }
  await variations.removeIncludedProject(variationId, projectId);
  return { removed: rows.length };
}

/**
 * Unschedule everything in a variation and reset its project scope to
 * empty. For a planning scenario this is "start over." For Master, this is
 * "nothing is scheduled" — the requirements it held are simply unscheduled,
 * not gone, and can be re-planned and re-published like any other.
 */
export async function clearVariation(variationId: string) {
  const rows = await prisma.scheduleAssignment.findMany({
    where: { variationId },
    select: { id: true },
  });
  for (const row of rows) {
    await unassign(row.id);
  }
  await variations.setIncludedProjects(variationId, []);
  return { removed: rows.length };
}

// ---------------------------------------------------------------------------
// Bulk shift — "the whole show moved back two weeks"
// ---------------------------------------------------------------------------

export type ShiftScope =
  | { kind: "ENTIRE_VARIATION" }
  | { kind: "SELECTED_PROJECTS"; projectIds: string[] }
  | { kind: "SELECTED_ASSIGNMENTS"; assignmentIds: string[] }
  | { kind: "DATE_RANGE"; from: Date; to: Date };

export interface ShiftPreviewRow {
  assignmentId: string;
  projectName: string;
  label: string;
  from: { startDate: Date; endDate: Date };
  to: { startDate: Date; endDate: Date };
  durationDays: number;
}

function scopeWhere(variationId: string, scope: ShiftScope) {
  switch (scope.kind) {
    case "ENTIRE_VARIATION":
      return { variationId };
    case "SELECTED_PROJECTS":
      return { variationId, projectId: { in: scope.projectIds } };
    case "SELECTED_ASSIGNMENTS":
      return { variationId, id: { in: scope.assignmentIds } };
    case "DATE_RANGE":
      return {
        variationId,
        startDate: { gte: normalizeScheduleDate(scope.from) },
        endDate: { lte: normalizeScheduleDate(scope.to) },
      };
  }
}

/**
 * What a shift *would* do. Pure read — there is no write path in this
 * function at all, so a preview cannot mutate anything by accident.
 */
export async function previewShift(input: {
  variationId: string;
  scope: ShiftScope;
  amount: number;
  unit: ShiftUnit;
}): Promise<ShiftPreviewRow[]> {
  const assignments = await prisma.scheduleAssignment.findMany({
    where: scopeWhere(input.variationId, input.scope),
    include: {
      project: { select: { name: true } },
      requirement: {
        include: {
          unitProduction: { select: { name: true } },
          eventType: { select: { name: true } },
        },
      },
    },
    orderBy: [{ projectId: "asc" }, { startDate: "asc" }],
  });

  const ctx = await loadWorkCalendarContext(input.variationId);

  return assignments.map((a) => {
    const moved = shiftBlock(
      a.startDate,
      a.durationDays,
      input.amount,
      input.unit,
      ctx,
      a.projectId
    );
    return {
      assignmentId: a.id,
      projectName: a.project.name,
      label:
        a.requirement.label ??
        a.requirement.unitProduction?.name ??
        a.requirement.eventType?.name ??
        "Untitled",
      from: { startDate: a.startDate, endDate: a.endDate },
      to: moved,
      durationDays: a.durationDays,
    };
  });
}

/**
 * Apply a shift. Transactional: a bulk move that half-succeeds would be worse
 * than one that fails outright, since nobody would know which half moved.
 */
export async function applyShift(input: {
  variationId: string;
  scope: ShiftScope;
  amount: number;
  unit: ShiftUnit;
}) {
  const rows = await previewShift(input);
  if (rows.length === 0) return { moved: 0 };

  await prisma.$transaction(
    rows.map((r) =>
      prisma.scheduleAssignment.update({
        where: { id: r.assignmentId },
        data: { startDate: r.to.startDate, endDate: r.to.endDate },
      })
    )
  );

  return { moved: rows.length };
}
