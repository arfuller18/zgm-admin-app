// Read models for the scheduling UI. Kept out of the page components so the
// same shapes can back a calendar, a timeline, or an API response later.

import { prisma } from "../prisma";
import { formatScheduleDate } from "./work-calendar";

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

/**
 * Every project a schedule could be scoped to — not just ones with existing
 * requirements, since picking a project at variation-creation time is about
 * planning ahead, not just reacting to what's already there.
 */
export async function listSchedulableProjects() {
  return prisma.project.findMany({
    where: { currentStatus: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, projectColor: true },
  });
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

/**
 * Flatten a workspace into one row per placed assignment, for UI that needs
 * to pick individual placements (the bulk-shift scope selector) rather than
 * walk the project → requirement → assignment tree. Server-side only, same
 * as everything else in this module — the caller serialises what it needs
 * into a Client Component, not this function itself.
 */
export function flattenWorkspaceAssignments(data: WorkspaceData) {
  const out: {
    id: string;
    projectId: string;
    projectName: string;
    label: string;
    startDate: string;
    endDate: string;
    durationDays: number;
  }[] = [];
  for (const p of data.projects) {
    for (const r of p.schedulingRequirements) {
      for (const a of r.assignments) {
        out.push({
          id: a.id,
          projectId: p.id,
          projectName: p.name,
          label: requirementLabel(r),
          startDate: formatScheduleDate(a.startDate),
          endDate: formatScheduleDate(a.endDate),
          durationDays: a.durationDays,
        });
      }
    }
  }
  return out.sort((x, y) => x.startDate.localeCompare(y.startDate));
}

export type FlatWorkspaceAssignment = ReturnType<typeof flattenWorkspaceAssignments>[number];

/**
 * One placement's full display row, by id — the same shape
 * loadScheduleWindow returns, so a brand-new assignment (dragging an
 * unscheduled item onto the calendar creates one with no prior row to
 * update) can be merged into a client's existing item list without a
 * separate field mapping to keep in sync.
 */
export async function getAssignmentDisplay(assignmentId: string) {
  const a = await prisma.scheduleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
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
  return {
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
  };
}

/**
 * Unscheduled requirements for a variation's included projects only — the
 * drawer's contents. "Unscheduled" here means specifically "no placement in
 * this variation," not unscheduled everywhere: the same requirement can be
 * placed in one scenario and still sit in another's drawer, which is
 * exactly the point of variation isolation.
 */
export interface UnscheduledItem {
  requirementId: string;
  projectId: string;
  projectName: string;
  projectColor: WorkspaceProject["projectColor"];
  label: string;
  durationDays: number;
  kind: WorkspaceRequirement["kind"];
}

export function unscheduledItems(data: WorkspaceData, includedProjectIds: string[]): UnscheduledItem[] {
  const scope = new Set(includedProjectIds);
  const out: UnscheduledItem[] = [];
  for (const p of data.projects) {
    if (!scope.has(p.id)) continue;
    for (const r of p.schedulingRequirements) {
      if (r.assignments.length > 0) continue;
      out.push({
        requirementId: r.id,
        projectId: p.id,
        projectName: p.name,
        projectColor: p.projectColor,
        label: requirementLabel(r),
        durationDays: r.durationDays,
        kind: r.kind,
      });
    }
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.label.localeCompare(b.label));
}
