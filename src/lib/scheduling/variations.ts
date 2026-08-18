// Planning scenarios, and the Master Calendar.
//
// Master is a ScheduleVariation row with kind = MASTER, kept singleton by a
// partial unique index in the migration. It is never presented as "just
// another variation" in the UI, and the guards here make it structurally
// different too: it cannot be created twice, deleted, or archived.

import { prisma } from "../prisma";

export class SchedulingError extends Error {}

/** The Master Calendar. Created on demand so the app is never without one. */
export async function getMasterVariation() {
  const existing = await prisma.scheduleVariation.findFirst({ where: { kind: "MASTER" } });
  if (existing) return existing;

  const calendar = await prisma.workCalendar.findFirst({ where: { isDefault: true } });
  return prisma.scheduleVariation.create({
    data: {
      name: "Master Calendar",
      kind: "MASTER",
      status: "DRAFT",
      description: "ZGM's operational production schedule.",
      workCalendarId: calendar?.id ?? null,
    },
  });
}

export async function listVariations() {
  return prisma.scheduleVariation.findMany({
    where: { kind: "VARIATION" },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { _count: { select: { assignments: true } }, sourceVariation: { select: { name: true } } },
  });
}

export async function getVariation(id: string) {
  return prisma.scheduleVariation.findUnique({
    where: { id },
    include: { workCalendar: true, sourceVariation: { select: { id: true, name: true } } },
  });
}

export type CreateVariationMode = "BLANK" | "DUPLICATE" | "COPY_MASTER";

/**
 * Create a planning scenario.
 *
 *   BLANK        nothing placed — every requirement starts unscheduled
 *   DUPLICATE    clone another variation's placements
 *   COPY_MASTER  start from the current operational schedule
 *
 * None of these touch the source: copying Master leaves Master alone, which
 * is the whole point of a scenario.
 */
export async function createVariation(input: {
  name: string;
  description?: string | null;
  mode: CreateVariationMode;
  sourceVariationId?: string | null;
  createdById?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new SchedulingError("A variation needs a name.");

  let sourceId: string | null = null;
  if (input.mode === "DUPLICATE") {
    if (!input.sourceVariationId) {
      throw new SchedulingError("Pick a variation to duplicate.");
    }
    sourceId = input.sourceVariationId;
  } else if (input.mode === "COPY_MASTER") {
    sourceId = (await getMasterVariation()).id;
  }

  const calendar = await prisma.workCalendar.findFirst({ where: { isDefault: true } });

  return prisma.$transaction(async (tx) => {
    const variation = await tx.scheduleVariation.create({
      data: {
        name,
        description: input.description?.trim() || null,
        kind: "VARIATION",
        status: "DRAFT",
        sourceVariationId: sourceId,
        workCalendarId: calendar?.id ?? null,
        createdById: input.createdById ?? null,
      },
    });

    if (sourceId) {
      const source = await tx.scheduleAssignment.findMany({ where: { variationId: sourceId } });
      if (source.length > 0) {
        await tx.scheduleAssignment.createMany({
          data: source.map((a) => ({
            variationId: variation.id,
            requirementId: a.requirementId,
            projectId: a.projectId,
            startDate: a.startDate,
            endDate: a.endDate,
            durationDays: a.durationDays,
            locationId: a.locationId,
            notes: a.notes,
            // legacyPhaseId is deliberately NOT copied — it is unique and
            // belongs to the original backfilled row, not to this copy.
          })),
        });
      }
    }

    return variation;
  });
}

export async function renameVariation(id: string, name: string, description?: string | null) {
  const variation = await prisma.scheduleVariation.findUnique({ where: { id } });
  if (!variation) throw new SchedulingError("Variation not found.");
  if (variation.kind === "MASTER") {
    throw new SchedulingError("The Master Calendar cannot be renamed.");
  }
  return prisma.scheduleVariation.update({
    where: { id },
    data: { name: name.trim(), description: description?.trim() || null },
  });
}

export async function archiveVariation(id: string) {
  const variation = await prisma.scheduleVariation.findUnique({ where: { id } });
  if (!variation) throw new SchedulingError("Variation not found.");
  if (variation.kind === "MASTER") {
    throw new SchedulingError("The Master Calendar cannot be archived.");
  }
  return prisma.scheduleVariation.update({ where: { id }, data: { status: "ARCHIVED" } });
}

/**
 * Delete a scenario and its placements. Requirements and production entities
 * are untouched — unscheduling is not deleting.
 */
export async function deleteVariation(id: string) {
  const variation = await prisma.scheduleVariation.findUnique({ where: { id } });
  if (!variation) throw new SchedulingError("Variation not found.");
  if (variation.kind === "MASTER") {
    throw new SchedulingError("The Master Calendar cannot be deleted.");
  }
  await prisma.scheduleVariation.delete({ where: { id } });
}
