import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  mapProjectFormat,
  mapProjectStatus,
  mapPriority,
  mapProjectColor,
  toDate,
  isPlaceholderProject,
} from "../src/lib/airtable-mappings";

// One-time bootstrap from a snapshot of the live Zero Gravity Media
// Airtable base (app1C5WNULP6I61dM), pulled 2026-08-16. Ongoing updates
// after this point should come from `npm run sync:airtable`
// (src/lib/airtable-sync.ts), not by re-running this script.

const DATA_DIR = join(__dirname, "seed-data");

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
}

type RawProject = {
  airtableId: string;
  name: string;
  projectId: string | null;
  format: string | null;
  seasonFilm: string | null;
  episodeCount: number | null;
  currentStatus: string | null;
  priority: string | null;
  zgmOwner: string | null;
  rightsStatus: string | null;
  rightsExpiration: string | null;
  scriptStatus: string | null;
  salesDistributionStatus: string | null;
  salesDistributionNotes: string | null;
  whyZgm: string | null;
  audienceHook: string | null;
  biggestRisk: string | null;
  nextDecision: string | null;
  nextAction: string | null;
  nextActionDueDate: string | null;
  logline: string | null;
  projectColor: string | null;
  genre: string | null;
  additionalNotes: string | null;
  mainContactRole: string | null;
  taxCreditNotes: string | null;
  executiveOwnerIds: string[];
  dayToDayOwnerIds: string[];
  showrunnerIds: string[];
  keyTalentIds: string[];
  keyCrewIds: string[];
  importantContactIds: string[];
  locationIds: string[];
};

type RawContact = {
  airtableId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  contactType: string[];
  profession: string[];
};

type RawLocation = {
  airtableId: string;
  name: string;
  locationType: string[];
  usedOnUnitProductionIds: string[];
};

type RawUnitProduction = {
  airtableId: string;
  name: string;
  season: number | null;
  episode: number | null;
  episodeTitle: string | null;
  bookedBy: string | null;
  bookingWindow: string | null;
  notes: string | null;
  duration: number | null;
  scriptStatus: string | null;
  projectIds: string[];
  directorIds: string[];
  writerIds: string[];
  locationIds: string[];
};

type RawSchedulePhase = {
  airtableId: string;
  scheduleId: string | null;
  startDate: string | null;
  endDate: string | null;
  workDays: number | null;
  calendarDays: number | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  parentProjectId: string | null;
  recordType: string | null;
  phase: string | null;
  projectIds: string[];
  unitProductionIds: string[];
};

type RawShootDay = {
  airtableId: string;
  shootDayId: string | null;
  date: string | null;
  seasonShootDay: number | null;
  episodeDay: number | null;
  dayOfWeek: string | null;
  location: string | null;
  planningNote: string | null;
  recordType: string | null;
  projectIds: string[];
  unitProductionIds: string[];
  parentScheduleIds: string[];
};

async function main() {
  const projects = load<RawProject[]>("projects.json").filter(
    (p) => !isPlaceholderProject(p)
  );
  const contacts = load<RawContact[]>("contacts.json");
  const locations = load<RawLocation[]>("locations.json");
  const unitProductions = load<RawUnitProduction[]>("unit-productions.json");
  const schedulePhases = load<RawSchedulePhase[]>("schedule-phases.json");
  const shootDays = load<RawShootDay[]>("shoot-days.json");

  console.log(
    `Seeding ${projects.length} projects, ${contacts.length} contacts, ${locations.length} locations, ${unitProductions.length} unit productions, ${schedulePhases.length} schedule phases, ${shootDays.length} shoot days...`
  );

  // 0. Bootstrap admin user, so there's someone to sign in as from the start
  // (matches the PRD's named Owner). Anyone else added later goes through
  // /admin/users or the first-sign-in-becomes-admin bootstrap in auth.ts.
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "arfuller18@gmail.com";
  await prisma.user.upsert({
    where: { email: bootstrapEmail },
    update: {},
    create: {
      email: bootstrapEmail,
      name: "Allison Fuller",
      role: "ADMIN",
      active: true,
    },
  });

  // 1. People (from linked Contact List records)
  for (const c of contacts) {
    await prisma.person.upsert({
      where: { airtableId: c.airtableId },
      update: {
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        contactType: c.contactType,
        profession: c.profession,
      },
      create: {
        airtableId: c.airtableId,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        contactType: c.contactType,
        profession: c.profession,
      },
    });
  }

  // 2. Locations
  for (const l of locations) {
    await prisma.location.upsert({
      where: { airtableId: l.airtableId },
      update: { name: l.name, locationType: l.locationType },
      create: {
        airtableId: l.airtableId,
        name: l.name,
        locationType: l.locationType,
      },
    });
  }

  // 3. Projects
  for (const p of projects) {
    const data = {
      name: p.name.trim(),
      projectCode: p.projectId || null,
      format: mapProjectFormat(p.format),
      seasonFilm: p.seasonFilm,
      episodeCount: p.episodeCount,
      currentStatus: mapProjectStatus(p.currentStatus),
      priority: mapPriority(p.priority),
      zgmOwner: p.zgmOwner,
      rightsStatus: p.rightsStatus,
      rightsExpiration: toDate(p.rightsExpiration),
      scriptStatus: p.scriptStatus,
      salesDistributionStatus: p.salesDistributionStatus,
      salesDistributionNotes: p.salesDistributionNotes,
      genre: p.genre,
      projectColor: mapProjectColor(p.projectColor),
      mainContactRole: p.mainContactRole,
      logline: p.logline,
      whyZgm: p.whyZgm,
      audienceHook: p.audienceHook,
      biggestRisk: p.biggestRisk,
      additionalNotes: p.additionalNotes,
      taxCreditNotes: p.taxCreditNotes,
      nextDecision: p.nextDecision,
      nextAction: p.nextAction,
      nextActionDueDate: toDate(p.nextActionDueDate),
    };
    await prisma.project.upsert({
      where: { airtableId: p.airtableId },
      update: data,
      create: { airtableId: p.airtableId, ...data },
    });
  }

  // 4. Project <-> Person relations (executive owner, showrunner, etc.)
  const relationFields: Array<{
    key: keyof RawProject;
    relation:
      | "EXECUTIVE_OWNER"
      | "DAY_TO_DAY_OWNER"
      | "SHOWRUNNER"
      | "KEY_TALENT"
      | "KEY_CREW"
      | "IMPORTANT_CONTACT";
  }> = [
    { key: "executiveOwnerIds", relation: "EXECUTIVE_OWNER" },
    { key: "dayToDayOwnerIds", relation: "DAY_TO_DAY_OWNER" },
    { key: "showrunnerIds", relation: "SHOWRUNNER" },
    { key: "keyTalentIds", relation: "KEY_TALENT" },
    { key: "keyCrewIds", relation: "KEY_CREW" },
    { key: "importantContactIds", relation: "IMPORTANT_CONTACT" },
  ];
  for (const p of projects) {
    const project = await prisma.project.findUnique({
      where: { airtableId: p.airtableId },
    });
    if (!project) continue;
    for (const { key, relation } of relationFields) {
      const ids = p[key] as string[];
      for (const airtableId of ids) {
        const person = await prisma.person.findUnique({
          where: { airtableId },
        });
        if (!person) continue; // contact not in our People snapshot
        await prisma.projectContact.upsert({
          where: {
            projectId_personId_relation: {
              projectId: project.id,
              personId: person.id,
              relation,
            },
          },
          update: {},
          create: { projectId: project.id, personId: person.id, relation },
        });
      }
    }
  }

  // 5. Unit Productions
  for (const u of unitProductions) {
    const projectAirtableId = u.projectIds[0];
    if (!projectAirtableId) continue;
    const project = await prisma.project.findUnique({
      where: { airtableId: projectAirtableId },
    });
    if (!project) continue; // belongs to a filtered-out placeholder project

    const directorAirtableId = u.directorIds[0];
    const writerAirtableId = u.writerIds[0];
    const director = directorAirtableId
      ? await prisma.person.findUnique({ where: { airtableId: directorAirtableId } })
      : null;
    const writer = writerAirtableId
      ? await prisma.person.findUnique({ where: { airtableId: writerAirtableId } })
      : null;

    const data = {
      name: u.name.trim(),
      season: u.season,
      episode: u.episode,
      episodeTitle: u.episodeTitle,
      scriptStatus: u.scriptStatus,
      duration: u.duration,
      bookedBy: u.bookedBy,
      bookingWindow: u.bookingWindow,
      notes: u.notes,
      projectId: project.id,
      directorId: director?.id ?? null,
      writerId: writer?.id ?? null,
    };
    await prisma.unitProduction.upsert({
      where: { airtableId: u.airtableId },
      update: data,
      create: { airtableId: u.airtableId, ...data },
    });

    if (u.locationIds.length > 0) {
      const locationRecords = await prisma.location.findMany({
        where: { airtableId: { in: u.locationIds } },
        select: { id: true },
      });
      await prisma.unitProduction.update({
        where: { airtableId: u.airtableId },
        data: {
          locations: { connect: locationRecords.map((l) => ({ id: l.id })) },
        },
      });
    }
  }

  // 6. Production Schedule phases
  for (const s of schedulePhases) {
    const projectAirtableId = s.projectIds[0];
    if (!projectAirtableId) continue;
    const project = await prisma.project.findUnique({
      where: { airtableId: projectAirtableId },
    });
    if (!project) continue;

    const data = {
      scheduleCode: s.scheduleId,
      phase: s.phase ?? "Unspecified",
      startDate: toDate(s.startDate),
      endDate: toDate(s.endDate),
      workDays: s.workDays,
      calendarDays: s.calendarDays,
      location: s.location,
      notes: s.notes,
      status: s.status,
      projectId: project.id,
    };
    await prisma.productionSchedulePhase.upsert({
      where: { airtableId: s.airtableId },
      update: data,
      create: { airtableId: s.airtableId, ...data },
    });

    if (s.unitProductionIds.length > 0) {
      const units = await prisma.unitProduction.findMany({
        where: { airtableId: { in: s.unitProductionIds } },
        select: { id: true },
      });
      await prisma.productionSchedulePhase.update({
        where: { airtableId: s.airtableId },
        data: { unitProductions: { connect: units.map((u) => ({ id: u.id })) } },
      });
    }
  }

  // 7. Shoot Days
  for (const d of shootDays) {
    const projectAirtableId = d.projectIds[0];
    if (!projectAirtableId) continue;
    const project = await prisma.project.findUnique({
      where: { airtableId: projectAirtableId },
    });
    if (!project) continue;

    const unitAirtableId = d.unitProductionIds[0];
    const unit = unitAirtableId
      ? await prisma.unitProduction.findUnique({ where: { airtableId: unitAirtableId } })
      : null;

    const scheduleAirtableId = d.parentScheduleIds[0];
    const schedule = scheduleAirtableId
      ? await prisma.productionSchedulePhase.findUnique({
          where: { airtableId: scheduleAirtableId },
        })
      : null;

    const data = {
      shootDayCode: d.shootDayId,
      date: toDate(d.date),
      seasonShootDay: d.seasonShootDay,
      episodeDay: d.episodeDay,
      dayOfWeek: d.dayOfWeek,
      location: d.location,
      planningNote: d.planningNote,
      projectId: project.id,
      unitProductionId: unit?.id ?? null,
      parentScheduleId: schedule?.id ?? null,
    };
    await prisma.shootDay.upsert({
      where: { airtableId: d.airtableId },
      update: data,
      create: { airtableId: d.airtableId, ...data },
    });
  }

  const [projectCount, unitCount, phaseCount, dayCount, locationCount, personCount] =
    await Promise.all([
      prisma.project.count(),
      prisma.unitProduction.count(),
      prisma.productionSchedulePhase.count(),
      prisma.shootDay.count(),
      prisma.location.count(),
      prisma.person.count(),
    ]);

  console.log("Seed complete:", {
    projectCount,
    unitCount,
    phaseCount,
    dayCount,
    locationCount,
    personCount,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
