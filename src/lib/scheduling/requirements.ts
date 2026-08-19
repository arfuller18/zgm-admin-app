// What a project needs scheduled, and for how long.
//
// A requirement is the durable statement of need ("EOTV needs Prep for 10
// production days"). Where it lands is an assignment, and it can land
// differently in every variation. Removing an assignment returns the
// requirement to DRAFT — it never deletes the requirement, and never touches
// the underlying Project or UnitProduction.

import { prisma } from "../prisma";
import { SchedulingError } from "./variations";
import type { RequirementStatus } from "../../../generated/prisma/enums";

export async function listEventTypes() {
  return prisma.productionEventType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Every requirement for a project, with where it currently sits. */
export async function listRequirements(projectId: string, variationId?: string) {
  return prisma.schedulingRequirement.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      unitProduction: { select: { id: true, name: true, season: true, episode: true } },
      eventType: { select: { id: true, name: true, defaultDurationDays: true } },
      assignments: variationId
        ? { where: { variationId }, orderBy: { startDate: "asc" } }
        : { orderBy: { startDate: "asc" } },
    },
  });
}

export async function createUnitRequirement(input: {
  projectId: string;
  unitProductionId: string;
  durationDays: number;
  notes?: string | null;
}) {
  if (input.durationDays < 1) throw new SchedulingError("Duration must be at least one day.");
  return prisma.schedulingRequirement.upsert({
    where: {
      projectId_unitProductionId: {
        projectId: input.projectId,
        unitProductionId: input.unitProductionId,
      },
    },
    update: { durationDays: input.durationDays, notes: input.notes ?? null },
    create: {
      projectId: input.projectId,
      kind: "UNIT_PRODUCTION",
      unitProductionId: input.unitProductionId,
      durationDays: input.durationDays,
      notes: input.notes ?? null,
      status: "DRAFT",
    },
  });
}

export async function createEventRequirement(input: {
  projectId: string;
  eventTypeId: string;
  durationDays?: number | null;
  label?: string | null;
  notes?: string | null;
}) {
  const type = await prisma.productionEventType.findUnique({ where: { id: input.eventTypeId } });
  if (!type) throw new SchedulingError("Unknown production event type.");

  // The type's default is a suggestion, applied only when nothing is given.
  const durationDays = input.durationDays ?? type.defaultDurationDays ?? 1;
  if (durationDays < 1) throw new SchedulingError("Duration must be at least one day.");

  return prisma.schedulingRequirement.create({
    data: {
      projectId: input.projectId,
      kind: "PRODUCTION_EVENT",
      eventTypeId: input.eventTypeId,
      durationDays,
      label: input.label?.trim() || null,
      notes: input.notes ?? null,
      status: "DRAFT",
    },
  });
}

export async function updateRequirement(
  id: string,
  input: { durationDays?: number; label?: string | null; notes?: string | null; sortOrder?: number }
) {
  if (input.durationDays !== undefined && input.durationDays < 1) {
    throw new SchedulingError("Duration must be at least one day.");
  }
  return prisma.schedulingRequirement.update({
    where: { id },
    data: {
      ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
      ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

/**
 * Delete a requirement and every placement of it. The Project and
 * UnitProduction are untouched — this removes the *need*, not the production.
 */
export async function deleteRequirement(id: string) {
  await prisma.schedulingRequirement.delete({ where: { id } });
}

/**
 * Recompute a requirement's status from where it actually sits.
 *
 * These are genuinely different states and the UI distinguishes them:
 * planned inside a scenario is not the same as operationally scheduled.
 * COMPLETE is set by a human and is never overwritten here.
 */
export async function syncRequirementStatus(requirementId: string): Promise<RequirementStatus> {
  const requirement = await prisma.schedulingRequirement.findUnique({
    where: { id: requirementId },
    select: { status: true },
  });
  if (!requirement) throw new SchedulingError("Requirement not found.");
  if (requirement.status === "COMPLETE") return "COMPLETE";

  const assignments = await prisma.scheduleAssignment.findMany({
    where: { requirementId },
    select: { variation: { select: { kind: true } } },
  });

  const status: RequirementStatus = assignments.some((a) => a.variation.kind === "MASTER")
    ? "ON_MASTER"
    : assignments.length > 0
      ? "SCHEDULED_IN_VARIATION"
      : "DRAFT";

  await prisma.schedulingRequirement.update({ where: { id: requirementId }, data: { status } });
  return status;
}

export async function setRequirementComplete(id: string, complete: boolean) {
  if (complete) {
    return prisma.schedulingRequirement.update({ where: { id }, data: { status: "COMPLETE" } });
  }
  await prisma.schedulingRequirement.update({ where: { id }, data: { status: "DRAFT" } });
  await syncRequirementStatus(id);
  return prisma.schedulingRequirement.findUnique({ where: { id } });
}
