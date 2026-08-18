// Publishing a scenario to the Master Calendar.
//
// Master is the operational source of truth. A variation is a hypothesis, and
// nothing in it becomes real until it is pushed here. Push is therefore the
// most consequential action in the system, so it is: previewable without any
// write path, scoped so untouched projects genuinely stay untouched,
// transactional, and audited with before/after snapshots.

import { prisma } from "../prisma";
import { SchedulingError, getMasterVariation } from "./variations";
import { syncRequirementStatus } from "./requirements";
import type { PublicationScope } from "../../../generated/prisma/enums";

export interface ProjectPushSummary {
  projectId: string;
  projectName: string;
  incoming: number;
  /** Placements currently on Master that this push would replace. */
  replacing: number;
  existingRange: { startDate: Date; endDate: Date } | null;
  incomingRange: { startDate: Date; endDate: Date } | null;
  /** True when Master already holds a schedule for this project. */
  conflictsWithExisting: boolean;
}

export interface PushPreview {
  variationId: string;
  variationName: string;
  scope: PublicationScope;
  projects: ProjectPushSummary[];
  totalIncoming: number;
  totalReplacing: number;
}

function rangeOf(rows: { startDate: Date; endDate: Date }[]) {
  if (rows.length === 0) return null;
  return {
    startDate: rows.reduce((a, r) => (r.startDate < a ? r.startDate : a), rows[0].startDate),
    endDate: rows.reduce((a, r) => (r.endDate > a ? r.endDate : a), rows[0].endDate),
  };
}

async function resolveScope(variationId: string, projectIds?: string[]) {
  const variation = await prisma.scheduleVariation.findUnique({ where: { id: variationId } });
  if (!variation) throw new SchedulingError("Variation not found.");
  if (variation.kind === "MASTER") {
    throw new SchedulingError("The Master Calendar cannot be pushed to itself.");
  }

  const incoming = await prisma.scheduleAssignment.findMany({
    where: {
      variationId,
      ...(projectIds && projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
    },
    include: { project: { select: { id: true, name: true } } },
  });

  return { variation, incoming };
}

/**
 * What pushing would do — including which projects already have a Master
 * schedule that would be replaced. No writes, by construction.
 */
export async function previewPush(input: {
  variationId: string;
  projectIds?: string[];
}): Promise<PushPreview> {
  const { variation, incoming } = await resolveScope(input.variationId, input.projectIds);
  const master = await getMasterVariation();

  const affectedProjectIds = [...new Set(incoming.map((a) => a.projectId))];

  const existing = await prisma.scheduleAssignment.findMany({
    where: { variationId: master.id, projectId: { in: affectedProjectIds } },
  });

  const projects: ProjectPushSummary[] = affectedProjectIds.map((projectId) => {
    const inc = incoming.filter((a) => a.projectId === projectId);
    const ex = existing.filter((a) => a.projectId === projectId);
    return {
      projectId,
      projectName: inc[0]?.project.name ?? "Unknown project",
      incoming: inc.length,
      replacing: ex.length,
      existingRange: rangeOf(ex),
      incomingRange: rangeOf(inc),
      conflictsWithExisting: ex.length > 0,
    };
  });

  return {
    variationId: variation.id,
    variationName: variation.name,
    scope:
      input.projectIds && input.projectIds.length > 0 ? "SELECTED_PROJECTS" : "ENTIRE_VARIATION",
    projects: projects.sort((a, b) => a.projectName.localeCompare(b.projectName)),
    totalIncoming: incoming.length,
    totalReplacing: projects.reduce((n, p) => n + p.replacing, 0),
  };
}

/**
 * The hypothetical Master: "what would Master look like if I replaced these
 * projects with this variation's version?" Master's own rows for every other
 * project, plus the incoming rows for the affected ones. Read-only.
 */
export async function previewMergedMaster(input: { variationId: string; projectIds?: string[] }) {
  const { incoming } = await resolveScope(input.variationId, input.projectIds);
  const master = await getMasterVariation();
  const affected = [...new Set(incoming.map((a) => a.projectId))];

  const untouched = await prisma.scheduleAssignment.findMany({
    where: { variationId: master.id, projectId: { notIn: affected.length > 0 ? affected : ["_"] } },
    include: {
      project: { select: { id: true, name: true, projectColor: true } },
      requirement: {
        include: { unitProduction: { select: { name: true } }, eventType: { select: { name: true } } },
      },
    },
  });

  const incomingDetailed = await prisma.scheduleAssignment.findMany({
    where: { id: { in: incoming.map((a) => a.id) } },
    include: {
      project: { select: { id: true, name: true, projectColor: true } },
      requirement: {
        include: { unitProduction: { select: { name: true } }, eventType: { select: { name: true } } },
      },
    },
  });

  return [
    ...untouched.map((a) => ({ ...a, incoming: false })),
    ...incomingDetailed.map((a) => ({ ...a, incoming: true })),
  ].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Publish to Master.
 *
 * Replacement is per project: pushing EOTV and Playboy replaces exactly those
 * two on Master and leaves Monarchy alone. The whole operation is one
 * transaction, and a MasterPublication row records before/after snapshots so
 * the previous schedule is recoverable even after it is replaced again.
 */
export async function pushToMaster(input: {
  variationId: string;
  projectIds?: string[];
  publishedById?: string | null;
  note?: string | null;
}) {
  const { variation, incoming } = await resolveScope(input.variationId, input.projectIds);
  if (incoming.length === 0) {
    throw new SchedulingError("This variation has nothing to publish for the selected projects.");
  }

  const master = await getMasterVariation();
  const affected = [...new Set(incoming.map((a) => a.projectId))];

  const replaced = await prisma.scheduleAssignment.findMany({
    where: { variationId: master.id, projectId: { in: affected } },
  });

  const scope: PublicationScope =
    input.projectIds && input.projectIds.length > 0 ? "SELECTED_PROJECTS" : "ENTIRE_VARIATION";

  const publication = await prisma.$transaction(async (tx) => {
    // Only the affected projects are cleared. Everything else on Master is
    // untouched — that is what makes a partial push safe.
    await tx.scheduleAssignment.deleteMany({
      where: { variationId: master.id, projectId: { in: affected } },
    });

    await tx.scheduleAssignment.createMany({
      data: incoming.map((a) => ({
        variationId: master.id,
        requirementId: a.requirementId,
        projectId: a.projectId,
        startDate: a.startDate,
        endDate: a.endDate,
        durationDays: a.durationDays,
        locationId: a.locationId,
        notes: a.notes,
      })),
    });

    return tx.masterPublication.create({
      data: {
        sourceVariationId: variation.id,
        scope,
        projectIds: affected,
        replacedSnapshot: JSON.parse(JSON.stringify(replaced)),
        // Snapshot the assignment rows only; the joined project record would
        // just bloat the audit trail.
        appliedSnapshot: JSON.parse(
          JSON.stringify(
            incoming.map((a) => ({
              id: a.id,
              requirementId: a.requirementId,
              projectId: a.projectId,
              startDate: a.startDate,
              endDate: a.endDate,
              durationDays: a.durationDays,
              locationId: a.locationId,
              notes: a.notes,
            }))
          )
        ),
        assignmentsAdded: incoming.length,
        assignmentsReplaced: replaced.length,
        assignmentsRemoved: 0,
        publishedById: input.publishedById ?? null,
        note: input.note?.trim() || null,
      },
    });
  });

  // Statuses follow the data rather than being set optimistically.
  const requirementIds = [
    ...new Set([...incoming.map((a) => a.requirementId), ...replaced.map((a) => a.requirementId)]),
  ];
  for (const id of requirementIds) {
    await syncRequirementStatus(id);
  }

  return { publication, added: incoming.length, replaced: replaced.length };
}

export async function listPublications(limit = 25) {
  return prisma.masterPublication.findMany({
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      sourceVariation: { select: { id: true, name: true } },
      publishedBy: { select: { name: true, email: true } },
    },
  });
}
