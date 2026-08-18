// Migrates the legacy ProductionSchedulePhase / ShootDay data into the
// scheduling engine, landing everything on the Master Calendar.
//
// Deliberately IDEMPOTENT rather than one large transaction: re-running is
// the recovery path if it fails partway, which matters more than atomicity
// against a pooled connection. Every step keys off a stable identifier
// (`legacyPhaseId`, slugs, unit ids) so a second run is a no-op.
//
// Nothing is deleted. ProductionSchedulePhase and ShootDay.parentScheduleId
// are left exactly as they were so the two models can be reconciled before
// the legacy table is dropped in a later migration.
//
// Callable from the CLI (prisma/backfill-scheduling.ts) or from
// Admin → Scheduling Setup, which is how it gets run against production.

import { prisma } from "../prisma";

const MASTER_NAME = "Master Calendar";
const DEFAULT_CALENDAR_NAME = "ZGM Standard (Mon–Fri)";

export interface BackfillSummary {
  eventTypes: number;
  unitRequirementsFromPhases: number;
  eventRequirementsCreated: number;
  assignmentsOnMaster: number;
  draftRequirementsForUnscheduledUnits: number;
  shootDaysReparented: number;
  shootDaysStillUnparented: number;
  shootDayLocationsResolved: number;
  legacyPhases: number;
  masterAssignments: number;
  totalRequirements: number;
  totalShootDays: number;
  reconciled: string;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ZGM's standard schedulable events, with the default durations from the
// scheduling brief. Compound legacy names are preserved verbatim — splitting
// "Pickups / Sound / Wrap" into three types is a domain decision for ZGM to
// make later through the Production Event Type system, not something a
// migration should guess at.
const STANDARD_EVENT_TYPES: { name: string; defaultDurationDays: number | null }[] = [
  { name: "Development / Greenlight", defaultDurationDays: null },
  { name: "Prep", defaultDurationDays: 10 },
  { name: "Tech Scout", defaultDurationDays: 1 },
  { name: "Travel", defaultDurationDays: null },
  { name: "Principal Photography", defaultDurationDays: null },
  { name: "Stunts", defaultDurationDays: 5 },
  { name: "Company Move / Atlantic Crossing", defaultDurationDays: null },
  { name: "Stunts / Inserts / Wrap", defaultDurationDays: null },
  { name: "Pickups / Sound / Wrap", defaultDurationDays: null },
  { name: "Sound", defaultDurationDays: 3 },
  { name: "VFX", defaultDurationDays: null },
  { name: "Post Production", defaultDurationDays: 30 },
  { name: "Reshoots", defaultDurationDays: null },
  { name: "Delivery", defaultDurationDays: null },
];

export async function runSchedulingBackfill(): Promise<BackfillSummary> {
  // 1. Event type catalogue — the standard set, plus any legacy phase name
  //    not already covered, so no historical value is lost in translation.
  const legacyPhaseNames = (
    await prisma.productionSchedulePhase.findMany({
      distinct: ["phase"],
      select: { phase: true },
    })
  ).map((p) => p.phase);

  const allTypeNames = [...STANDARD_EVENT_TYPES];
  for (const name of legacyPhaseNames) {
    if (!allTypeNames.some((t) => t.name === name)) {
      allTypeNames.push({ name, defaultDurationDays: null });
    }
  }

  for (const [i, t] of allTypeNames.entries()) {
    await prisma.productionEventType.upsert({
      where: { slug: slugify(t.name) },
      update: { name: t.name, sortOrder: i },
      create: {
        name: t.name,
        slug: slugify(t.name),
        defaultDurationDays: t.defaultDurationDays,
        sortOrder: i,
      },
    });
  }
  const eventTypes = await prisma.productionEventType.count();

  // 2. Default work calendar. Mon–Fri matches the seeded data exactly.
  let calendar = await prisma.workCalendar.findFirst({ where: { isDefault: true } });
  if (!calendar) {
    calendar = await prisma.workCalendar.create({
      data: { name: DEFAULT_CALENDAR_NAME, isDefault: true },
    });
  }

  // 3. The Master Calendar singleton. The partial unique index in the
  //    migration guarantees a second one cannot exist.
  let master = await prisma.scheduleVariation.findFirst({ where: { kind: "MASTER" } });
  if (!master) {
    master = await prisma.scheduleVariation.create({
      data: {
        name: MASTER_NAME,
        kind: "MASTER",
        status: "DRAFT",
        description:
          "ZGM's operational production schedule. Backfilled from the Airtable-imported production calendar.",
        workCalendarId: calendar.id,
      },
    });
  }

  // 4. Load every legacy phase with its (at most one) linked unit.
  const phases = await prisma.productionSchedulePhase.findMany({
    include: { unitProductions: { select: { id: true } } },
    orderBy: { startDate: "asc" },
  });

  const typesBySlug = new Map(
    (await prisma.productionEventType.findMany()).map((t) => [t.slug, t])
  );

  // Requirement durations are the SUM of their phases' workDays — a project
  // can split one requirement across several date blocks. Still Life does
  // exactly this with two "Pickups / Sound / Wrap" phases (40 + 5 days).
  const eventDurationTotals = new Map<string, number>();
  for (const p of phases) {
    if (p.unitProductions.length > 0) continue;
    const key = `${p.projectId}::${slugify(p.phase)}`;
    eventDurationTotals.set(key, (eventDurationTotals.get(key) ?? 0) + (p.workDays ?? 0));
  }

  let unitReqs = 0;
  let eventReqs = 0;
  let assignmentCount = 0;

  for (const phase of phases) {
    const unitId = phase.unitProductions[0]?.id ?? null;
    let requirementId: string;

    if (unitId) {
      const req = await prisma.schedulingRequirement.upsert({
        where: {
          projectId_unitProductionId: { projectId: phase.projectId, unitProductionId: unitId },
        },
        update: {},
        create: {
          projectId: phase.projectId,
          kind: "UNIT_PRODUCTION",
          unitProductionId: unitId,
          durationDays: Math.max(phase.workDays ?? 1, 1),
          status: "ON_MASTER",
        },
      });
      requirementId = req.id;
      unitReqs++;
    } else {
      const type = typesBySlug.get(slugify(phase.phase));
      if (!type) throw new Error(`No event type for legacy phase "${phase.phase}"`);

      const existing = await prisma.schedulingRequirement.findFirst({
        where: { projectId: phase.projectId, eventTypeId: type.id },
      });
      if (existing) {
        requirementId = existing.id;
      } else {
        const total =
          eventDurationTotals.get(`${phase.projectId}::${type.slug}`) ?? phase.workDays ?? 1;
        const req = await prisma.schedulingRequirement.create({
          data: {
            projectId: phase.projectId,
            kind: "PRODUCTION_EVENT",
            eventTypeId: type.id,
            durationDays: Math.max(total, 1),
            status: "ON_MASTER",
          },
        });
        requirementId = req.id;
        eventReqs++;
      }
    }

    if (!phase.startDate || !phase.endDate) continue;
    const data = {
      variationId: master.id,
      requirementId,
      projectId: phase.projectId,
      startDate: phase.startDate,
      endDate: phase.endDate,
      durationDays: Math.max(phase.workDays ?? 1, 1),
      // The legacy `status` column holds provenance, not state — values like
      // "User-directed schedule revision" and "Working assumption". That is
      // real planning history, so it is preserved rather than discarded.
      notes: [phase.status, phase.notes].filter(Boolean).join("\n\n") || null,
      airtableId: phase.airtableId,
    };
    await prisma.scheduleAssignment.upsert({
      where: { legacyPhaseId: phase.id },
      update: data,
      create: { ...data, legacyPhaseId: phase.id },
    });
    assignmentCount++;
  }

  // 5. Units with no phase at all become genuine unscheduled requirements —
  //    visible in the sidebar as work that still needs placing.
  const orphanUnits = await prisma.unitProduction.findMany({
    where: { schedulingRequirements: { none: {} } },
    select: { id: true, projectId: true, duration: true },
  });
  for (const u of orphanUnits) {
    await prisma.schedulingRequirement.create({
      data: {
        projectId: u.projectId,
        kind: "UNIT_PRODUCTION",
        unitProductionId: u.id,
        durationDays: Math.max(u.duration ?? 5, 1),
        status: "DRAFT",
        notes: "Duration defaulted during backfill — confirm before scheduling.",
      },
    });
  }

  // 6. Re-parent shoot days onto their assignment, via the legacy pointer.
  const assignmentByLegacy = new Map(
    (
      await prisma.scheduleAssignment.findMany({
        where: { legacyPhaseId: { not: null } },
        select: { id: true, legacyPhaseId: true },
      })
    ).map((a) => [a.legacyPhaseId!, a.id])
  );

  let reparented = 0;
  for (const [legacyPhaseId, assignmentId] of assignmentByLegacy) {
    const res = await prisma.shootDay.updateMany({
      where: { parentScheduleId: legacyPhaseId },
      data: { scheduleAssignmentId: assignmentId },
    });
    reparented += res.count;
  }

  // 7. Resolve free-text shoot-day locations to real Location records where
  //    the name matches exactly. Anything ambiguous keeps its text and is
  //    left for a human — a fuzzy match here would be worse than none.
  const locations = await prisma.location.findMany({ select: { id: true, name: true } });
  let locationsResolved = 0;
  for (const loc of locations) {
    const res = await prisma.shootDay.updateMany({
      where: { location: loc.name, locationId: null },
      data: { locationId: loc.id },
    });
    locationsResolved += res.count;
  }

  // 8. Reconciliation — the numbers to check before trusting the backfill
  //    enough to drop the legacy table.
  const [legacyPhases, masterAssignments, totalRequirements, totalShootDays, stillUnparented] =
    await Promise.all([
      prisma.productionSchedulePhase.count(),
      prisma.scheduleAssignment.count({ where: { variationId: master.id } }),
      prisma.schedulingRequirement.count(),
      prisma.shootDay.count(),
      prisma.shootDay.count({ where: { scheduleAssignmentId: null } }),
    ]);

  return {
    eventTypes,
    unitRequirementsFromPhases: unitReqs,
    eventRequirementsCreated: eventReqs,
    assignmentsOnMaster: assignmentCount,
    draftRequirementsForUnscheduledUnits: orphanUnits.length,
    shootDaysReparented: reparented,
    shootDaysStillUnparented: stillUnparented,
    shootDayLocationsResolved: locationsResolved,
    legacyPhases,
    masterAssignments,
    totalRequirements,
    totalShootDays,
    reconciled: legacyPhases === masterAssignments ? "YES" : "MISMATCH — investigate",
  };
}
