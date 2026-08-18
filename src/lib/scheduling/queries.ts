// Read models for the scheduling UI. Kept out of the page components so the
// same shapes can back a calendar, a timeline, or an API response later.

import { prisma } from "../prisma";

/**
 * Everything one variation needs, grouped by project.
 *
 * Requirements are returned whether or not they are placed — an item that is
 * already scheduled stays in the list, marked, rather than disappearing.
 * Hiding it would lose the sense of what a production still owes.
 */
export async function loadWorkspace(variationId: string) {
  const [projects, eventTypes] = await Promise.all([
    prisma.project.findMany({
      where: {
        currentStatus: { not: "ARCHIVED" },
        schedulingRequirements: { some: {} },
      },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        projectCode: true,
        projectColor: true,
        currentStatus: true,
        schedulingRequirements: {
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            kind: true,
            label: true,
            durationDays: true,
            status: true,
            unitProduction: { select: { id: true, name: true, season: true, episode: true } },
            eventType: { select: { id: true, name: true } },
            assignments: {
              where: { variationId },
              orderBy: { startDate: "asc" },
              select: {
                id: true,
                startDate: true,
                endDate: true,
                durationDays: true,
                notes: true,
              },
            },
          },
        },
      },
    }),
    prisma.productionEventType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, defaultDurationDays: true },
    }),
  ]);

  return { projects, eventTypes };
}

export type WorkspaceData = Awaited<ReturnType<typeof loadWorkspace>>;
export type WorkspaceProject = WorkspaceData["projects"][number];
export type WorkspaceRequirement = WorkspaceProject["schedulingRequirements"][number];

/** Human label for a requirement, whichever kind it is. */
export function requirementLabel(r: {
  label: string | null;
  unitProduction: { name: string } | null;
  eventType: { name: string } | null;
}) {
  return r.label ?? r.unitProduction?.name ?? r.eventType?.name ?? "Untitled";
}

/** Counts for the scheduling hub. */
export async function loadSchedulingOverview() {
  const master = await prisma.scheduleVariation.findFirst({ where: { kind: "MASTER" } });

  const [variations, masterAssignments, unscheduled, publications] = await Promise.all([
    prisma.scheduleVariation.findMany({
      where: { kind: "VARIATION", status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { assignments: true } },
        sourceVariation: { select: { name: true } },
      },
    }),
    master
      ? prisma.scheduleAssignment.count({ where: { variationId: master.id } })
      : Promise.resolve(0),
    prisma.schedulingRequirement.count({ where: { status: "DRAFT" } }),
    prisma.masterPublication.findMany({
      orderBy: { publishedAt: "desc" },
      take: 5,
      include: {
        sourceVariation: { select: { name: true } },
        publishedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  // The window Master actually covers, for the hub summary.
  const range = master
    ? await prisma.scheduleAssignment.aggregate({
        where: { variationId: master.id },
        _min: { startDate: true },
        _max: { endDate: true },
      })
    : null;

  return {
    master,
    masterAssignments,
    masterRange: range ? { start: range._min.startDate, end: range._max.endDate } : null,
    variations,
    unscheduled,
    publications,
  };
}

/**
 * Placements intersecting a date window — the shared read model behind both
 * the month calendar and the timeline. Anything *overlapping* the window is
 * included, not merely those starting inside it: a 50-day Prep block must
 * still render in the months it runs through.
 */
export async function loadScheduleWindow(input: {
  variationId: string;
  from: Date;
  to: Date;
  projectId?: string;
}) {
  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      variationId: input.variationId,
      startDate: { lte: input.to },
      endDate: { gte: input.from },
      ...(input.projectId ? { projectId: input.projectId } : {}),
    },
    orderBy: [{ startDate: "asc" }, { durationDays: "desc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      durationDays: true,
      projectId: true,
      project: { select: { name: true, projectColor: true, priority: true } },
      requirement: {
        select: {
          kind: true,
          label: true,
          unitProduction: { select: { name: true } },
          eventType: { select: { name: true } },
        },
      },
    },
  });

  return assignments.map((a) => ({
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate,
    durationDays: a.durationDays,
    projectId: a.projectId,
    projectName: a.project.name,
    projectColor: a.project.projectColor,
    projectPriority: a.project.priority,
    kind: a.requirement.kind,
    label: requirementLabel(a.requirement),
  }));
}

export type ScheduleWindowAssignment = Awaited<ReturnType<typeof loadScheduleWindow>>[number];
