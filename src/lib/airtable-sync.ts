// Ongoing pull-sync: Airtable (Zero Gravity Media base) -> our Postgres DB.
//
// This is intentionally one-directional. Airtable stays ZGM's day-to-day
// tool for now; this job keeps our DB current with it by upserting on
// `airtableId`. Records we invent ourselves (Booking, Equipment) have no
// Airtable equivalent and are never touched by this sync. Push-back
// (writing our edits to Airtable) is not implemented — see README.
//
// Run manually with `npm run sync:airtable`, or trigger from
// /admin/sync (ADMIN role only).

import Airtable, { type FieldSet, type Record as AirtableRecord } from "airtable";
import { prisma } from "./prisma";
import {
  mapProjectFormat,
  mapProjectStatus,
  mapPriority,
  mapProjectColor,
  toDate,
  isPlaceholderProject,
} from "./airtable-mappings";

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? "app1C5WNULP6I61dM";

const TABLES = {
  projectHub: "tblqFhY0bzJ4dEXY9",
  unitProductions: "tbleZI9pTCLk1XQoF",
  productionSchedule: "tbl9d5qco6dkpZirf",
  shootDays: "tblBbAegVRgCjubkQ",
  locationList: "tblAsC0xpURlt9agR",
  contactList: "tblsiIrCyM1UwJv9S",
} as const;

// Field IDs (not names) — Project Hub's "Project Name" and Contact List's
// "First Name" have a leading BOM character in their display name, so
// scripting against IDs avoids that entirely. See the base reference doc.
const F = {
  projectHub: {
    name: "fldpnbcRyCspQEsYM",
    projectId: "fldJM7MX4P0x1kD3e",
    format: "fldcCmz29nBmI9nCr",
    seasonFilm: "fldSaAFDj4ezZrueV",
    episodeCount: "fldnNxSw5nlsWfReB",
    currentStatus: "fldn7Zns12FgFWS71",
    priority: "fldNdBxx0zKNPjxVG",
    zgmOwner: "fldlnLHuq1IpXcEDR",
    rightsStatus: "fldtI3RhS0Ko7I5sv",
    rightsExpiration: "fldymi7SYDqvOLEKm",
    scriptStatus: "fldtVpeXmESb6PIbH",
    salesDistributionStatus: "fldlTz94IvPnjMeIu",
    salesDistributionNotes: "fldjPNa059SbOjK1B",
    whyZgm: "fldvb7rMqouYFennR",
    audienceHook: "fldJ5p3cyQdLK9q5O",
    biggestRisk: "fldIvSGvSC2vHCgR6",
    nextDecision: "fld7QZ1Pt90XyzT1A",
    nextAction: "fldNm8VutgthSfO0D",
    nextActionDueDate: "fldYLX8Kk9hsGFg6q",
    logline: "fldo8YwbPaSc3Ji07",
    projectColor: "fldfsrcoDBnzPaZ1C",
    genre: "fldPkNwPvy8bclsHW",
    additionalNotes: "fldntWXkIC64fXn1j",
    mainContactRole: "fldePhS7xOwdsB8CN",
    taxCreditNotes: "fldvUtvV6VW3hiRf2",
    executiveOwnerIds: "fldwUmLCB6gIM69hg",
    dayToDayOwnerIds: "fldxjXAgLRQksLwGt",
    showrunnerIds: "fldBd3Ruv0oOgN5MW",
    keyTalentIds: "fld9tvcdTEB9AGlrK",
    keyCrewIds: "fldyTzmWJbqD6bGSF",
    importantContactIds: "fldso5YMgJQ8rWP4x",
  },
  unitProductions: {
    name: "fldxd9xrJcOHYvKpb",
    project: "fldDAs8KgABwmz8QO",
    season: "fldJwElLpyMwCuynA",
    episode: "fldGabX3MNQnUOhAk",
    episodeTitle: "fldKqpztLabjwITki",
    director: "fld6xqLrH770gPSSy",
    writer: "fldPsz0DxKkVAypAe",
    bookedBy: "fldC9kDBf6nIcYzY0",
    bookingWindow: "fldR9vhUdo2UPV98p",
    notes: "fld5DkPtHigrVE5BQ",
    locations: "fldehyfuLfEFdAgWX",
    scriptStatus: "fldgAjhIEbHleRFjK",
    duration: "fldacQuUzOYKmpFpM",
  },
  productionSchedule: {
    scheduleId: "fldrUQmqSfOtmRqr9",
    project: "fldHRq3FZf1ba1Rdp",
    phase: "fldkuPwPzZlhIESQR",
    unitProductions: "fldjwc60VPVpMomck",
    startDate: "fldanAIdKg7Nt4fXQ",
    endDate: "fldetOA2OhjiDINcl",
    workDays: "fldyvsvyQu0NUYgih",
    calendarDays: "fldgLijUZ703E7TpZ",
    location: "fld3oA7SWW1paCKNr",
    notes: "fldWRDB58uFJXoBbU",
    status: "fldUMba3tdsQ8kj7w",
  },
  shootDays: {
    shootDayId: "fldj7ReiqnqV4eWKr",
    date: "fldGG6xhLwvtT7yyK",
    project: "fldPUu9wVma1rxOX3",
    episodeUnit: "fldDRtlvNoygeqtWx",
    seasonShootDay: "fldVuDcwT4AbrXnRr",
    episodeDay: "fldRlAGXtm3Ct7lxl",
    dayOfWeek: "flde6S6xhJyxTw14k",
    location: "fldVXhueMmv9f8h8g",
    planningNote: "fldYRWnOq3RxiUDb3",
    parentScheduleId: "fldv9IRjp0PvBOUM4",
  },
  locationList: {
    name: "flduauxXZdiLvvDkv",
    locationType: "fldrKc6NlRTNjdUG1",
    usedOnUnitProductions: "fldbZ6SkH6lOsyHja",
  },
  contactList: {
    firstName: "fld6yGgPfCUkhXnOt",
    lastName: "fld27WVrvkKfLUjYQ",
    fullName: "fldKNMblOgTmgERMO",
    email: "fldQTzoq7UGnLl6JU",
    phone: "fldHsmXHINRFsQmmP",
    contactType: "fldJt7IyEUI4sHnVN",
    profession: "fldVSa0RQ0TKoSot4",
  },
} as const;

type Cell = AirtableRecord<FieldSet>["fields"];

function str(fields: Cell, fieldId: string): string | null {
  const v = fields[fieldId];
  if (typeof v !== "string") return null;
  return v.replace("﻿", "").trim() || null;
}

function num(fields: Cell, fieldId: string): number | null {
  const v = fields[fieldId];
  return typeof v === "number" ? v : null;
}

function selectName(fields: Cell, fieldId: string): string | null {
  const v = fields[fieldId] as unknown;
  if (v && typeof v === "object" && "name" in v) return (v as { name: string }).name;
  return null;
}

function multiSelectNames(fields: Cell, fieldId: string): string[] {
  const v = fields[fieldId] as unknown;
  if (Array.isArray(v)) {
    return v
      .map((x) => (x && typeof x === "object" && "name" in x ? (x as { name: string }).name : null))
      .filter((x): x is string => !!x);
  }
  return [];
}

function linkIds(fields: Cell, fieldId: string): string[] {
  const v = fields[fieldId];
  return Array.isArray(v) ? (v as string[]) : [];
}

function getBase() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AIRTABLE_API_KEY is not set. Create a Personal Access Token at https://airtable.com/create/tokens with read access to the Zero Gravity Media base."
    );
  }
  return new Airtable({ apiKey }).base(BASE_ID);
}

async function fetchAll(base: ReturnType<typeof getBase>, tableId: string) {
  return base(tableId)
    .select({ returnFieldsByFieldId: true, pageSize: 100 })
    .all();
}

export interface SyncSummary {
  projects: number;
  unitProductions: number;
  schedulePhases: number;
  shootDays: number;
  locations: number;
  people: number;
}

export async function syncAirtable(): Promise<SyncSummary> {
  const startedAt = new Date();
  try {
    const base = getBase();

    const [projectRecords, unitRecords, scheduleRecords, dayRecords, locationRecords] =
      await Promise.all([
        fetchAll(base, TABLES.projectHub),
        fetchAll(base, TABLES.unitProductions),
        fetchAll(base, TABLES.productionSchedule),
        fetchAll(base, TABLES.shootDays),
        fetchAll(base, TABLES.locationList),
      ]);

    // Locations
    for (const r of locationRecords) {
      await prisma.location.upsert({
        where: { airtableId: r.id },
        update: {
          name: str(r.fields, F.locationList.name) ?? "Untitled Location",
          locationType: multiSelectNames(r.fields, F.locationList.locationType),
        },
        create: {
          airtableId: r.id,
          name: str(r.fields, F.locationList.name) ?? "Untitled Location",
          locationType: multiSelectNames(r.fields, F.locationList.locationType),
        },
      });
    }

    // Projects (skip empty placeholder records, e.g. "General ZGM Info")
    const realProjects = projectRecords.filter((r) => {
      const f = r.fields;
      return !isPlaceholderProject({
        projectId: str(f, F.projectHub.projectId),
        format: selectName(f, F.projectHub.format),
        currentStatus: selectName(f, F.projectHub.currentStatus),
      });
    });

    for (const r of realProjects) {
      const f = r.fields;
      const data = {
        name: (str(f, F.projectHub.name) ?? "Untitled Project").trim(),
        projectCode: str(f, F.projectHub.projectId),
        format: mapProjectFormat(selectName(f, F.projectHub.format)),
        seasonFilm: str(f, F.projectHub.seasonFilm),
        episodeCount: num(f, F.projectHub.episodeCount),
        currentStatus: mapProjectStatus(selectName(f, F.projectHub.currentStatus)),
        priority: mapPriority(selectName(f, F.projectHub.priority)),
        zgmOwner: str(f, F.projectHub.zgmOwner),
        rightsStatus: selectName(f, F.projectHub.rightsStatus),
        rightsExpiration: toDate(str(f, F.projectHub.rightsExpiration)),
        scriptStatus: selectName(f, F.projectHub.scriptStatus),
        salesDistributionStatus: selectName(f, F.projectHub.salesDistributionStatus),
        salesDistributionNotes: str(f, F.projectHub.salesDistributionNotes),
        genre: selectName(f, F.projectHub.genre),
        projectColor: mapProjectColor(selectName(f, F.projectHub.projectColor)),
        mainContactRole: selectName(f, F.projectHub.mainContactRole),
        logline: str(f, F.projectHub.logline),
        whyZgm: str(f, F.projectHub.whyZgm),
        audienceHook: str(f, F.projectHub.audienceHook),
        biggestRisk: str(f, F.projectHub.biggestRisk),
        additionalNotes: str(f, F.projectHub.additionalNotes),
        taxCreditNotes: str(f, F.projectHub.taxCreditNotes),
        nextDecision: str(f, F.projectHub.nextDecision),
        nextAction: str(f, F.projectHub.nextAction),
        nextActionDueDate: toDate(str(f, F.projectHub.nextActionDueDate)),
      };
      await prisma.project.upsert({
        where: { airtableId: r.id },
        update: data,
        create: { airtableId: r.id, ...data },
      });
    }

    // Referenced contacts (director/writer + project-level owner/talent/crew links)
    const relationFieldIds: Array<{
      fieldId: string;
      relation:
        | "EXECUTIVE_OWNER"
        | "DAY_TO_DAY_OWNER"
        | "SHOWRUNNER"
        | "KEY_TALENT"
        | "KEY_CREW"
        | "IMPORTANT_CONTACT";
    }> = [
      { fieldId: F.projectHub.executiveOwnerIds, relation: "EXECUTIVE_OWNER" },
      { fieldId: F.projectHub.dayToDayOwnerIds, relation: "DAY_TO_DAY_OWNER" },
      { fieldId: F.projectHub.showrunnerIds, relation: "SHOWRUNNER" },
      { fieldId: F.projectHub.keyTalentIds, relation: "KEY_TALENT" },
      { fieldId: F.projectHub.keyCrewIds, relation: "KEY_CREW" },
      { fieldId: F.projectHub.importantContactIds, relation: "IMPORTANT_CONTACT" },
    ];

    const contactIds = new Set<string>();
    for (const r of unitRecords) {
      linkIds(r.fields, F.unitProductions.director).forEach((id) => contactIds.add(id));
      linkIds(r.fields, F.unitProductions.writer).forEach((id) => contactIds.add(id));
    }
    for (const r of realProjects) {
      for (const { fieldId } of relationFieldIds) {
        linkIds(r.fields, fieldId).forEach((id) => contactIds.add(id));
      }
    }

    const contactIdList = Array.from(contactIds);
    const contactRecords: AirtableRecord<FieldSet>[] = [];
    const CHUNK = 40;
    for (let i = 0; i < contactIdList.length; i += CHUNK) {
      const chunk = contactIdList.slice(i, i + CHUNK);
      if (chunk.length === 0) continue;
      const formula = `OR(${chunk.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
      const recs = await base(TABLES.contactList)
        .select({ filterByFormula: formula, returnFieldsByFieldId: true })
        .all();
      contactRecords.push(...recs);
    }

    for (const r of contactRecords) {
      const f = r.fields;
      const fullName =
        str(f, F.contactList.fullName) ??
        [str(f, F.contactList.firstName), str(f, F.contactList.lastName)]
          .filter(Boolean)
          .join(" ") ??
        "Unnamed Contact";
      const data = {
        firstName: str(f, F.contactList.firstName),
        lastName: str(f, F.contactList.lastName),
        fullName,
        email: str(f, F.contactList.email),
        phone: str(f, F.contactList.phone),
        contactType: multiSelectNames(f, F.contactList.contactType),
        profession: multiSelectNames(f, F.contactList.profession),
      };
      await prisma.person.upsert({
        where: { airtableId: r.id },
        update: data,
        create: { airtableId: r.id, ...data },
      });
    }

    // Project <-> Person relations
    for (const r of realProjects) {
      const project = await prisma.project.findUnique({ where: { airtableId: r.id } });
      if (!project) continue;
      for (const { fieldId, relation } of relationFieldIds) {
        for (const airtableId of linkIds(r.fields, fieldId)) {
          const person = await prisma.person.findUnique({ where: { airtableId } });
          if (!person) continue;
          await prisma.projectContact.upsert({
            where: {
              projectId_personId_relation: { projectId: project.id, personId: person.id, relation },
            },
            update: {},
            create: { projectId: project.id, personId: person.id, relation },
          });
        }
      }
    }

    // Unit Productions
    for (const r of unitRecords) {
      const f = r.fields;
      const projectAirtableId = linkIds(f, F.unitProductions.project)[0];
      if (!projectAirtableId) continue;
      const project = await prisma.project.findUnique({ where: { airtableId: projectAirtableId } });
      if (!project) continue;

      const directorAirtableId = linkIds(f, F.unitProductions.director)[0];
      const writerAirtableId = linkIds(f, F.unitProductions.writer)[0];
      const director = directorAirtableId
        ? await prisma.person.findUnique({ where: { airtableId: directorAirtableId } })
        : null;
      const writer = writerAirtableId
        ? await prisma.person.findUnique({ where: { airtableId: writerAirtableId } })
        : null;

      const data = {
        name: (str(f, F.unitProductions.name) ?? "Untitled Unit").trim(),
        season: num(f, F.unitProductions.season),
        episode: num(f, F.unitProductions.episode),
        episodeTitle: str(f, F.unitProductions.episodeTitle),
        scriptStatus: selectName(f, F.unitProductions.scriptStatus),
        duration: num(f, F.unitProductions.duration),
        bookedBy: str(f, F.unitProductions.bookedBy),
        bookingWindow: str(f, F.unitProductions.bookingWindow),
        notes: str(f, F.unitProductions.notes),
        projectId: project.id,
        directorId: director?.id ?? null,
        writerId: writer?.id ?? null,
      };
      await prisma.unitProduction.upsert({
        where: { airtableId: r.id },
        update: data,
        create: { airtableId: r.id, ...data },
      });

      const locAirtableIds = linkIds(f, F.unitProductions.locations);
      if (locAirtableIds.length > 0) {
        const locs = await prisma.location.findMany({
          where: { airtableId: { in: locAirtableIds } },
          select: { id: true },
        });
        await prisma.unitProduction.update({
          where: { airtableId: r.id },
          data: { locations: { set: locs.map((l) => ({ id: l.id })) } },
        });
      }
    }

    // Production Schedule phases
    for (const r of scheduleRecords) {
      const f = r.fields;
      const projectAirtableId = linkIds(f, F.productionSchedule.project)[0];
      if (!projectAirtableId) continue;
      const project = await prisma.project.findUnique({ where: { airtableId: projectAirtableId } });
      if (!project) continue;

      const data = {
        scheduleCode: str(f, F.productionSchedule.scheduleId),
        phase: selectName(f, F.productionSchedule.phase) ?? "Unspecified",
        startDate: toDate(str(f, F.productionSchedule.startDate)),
        endDate: toDate(str(f, F.productionSchedule.endDate)),
        workDays: num(f, F.productionSchedule.workDays),
        calendarDays: num(f, F.productionSchedule.calendarDays),
        location: str(f, F.productionSchedule.location),
        notes: str(f, F.productionSchedule.notes),
        status: str(f, F.productionSchedule.status),
        projectId: project.id,
      };
      await prisma.productionSchedulePhase.upsert({
        where: { airtableId: r.id },
        update: data,
        create: { airtableId: r.id, ...data },
      });

      const unitAirtableIds = linkIds(f, F.productionSchedule.unitProductions);
      if (unitAirtableIds.length > 0) {
        const units = await prisma.unitProduction.findMany({
          where: { airtableId: { in: unitAirtableIds } },
          select: { id: true },
        });
        await prisma.productionSchedulePhase.update({
          where: { airtableId: r.id },
          data: { unitProductions: { set: units.map((u) => ({ id: u.id })) } },
        });
      }
    }

    // Shoot Days
    for (const r of dayRecords) {
      const f = r.fields;
      const projectAirtableId = linkIds(f, F.shootDays.project)[0];
      if (!projectAirtableId) continue;
      const project = await prisma.project.findUnique({ where: { airtableId: projectAirtableId } });
      if (!project) continue;

      const unitAirtableId = linkIds(f, F.shootDays.episodeUnit)[0];
      const unit = unitAirtableId
        ? await prisma.unitProduction.findUnique({ where: { airtableId: unitAirtableId } })
        : null;

      const scheduleAirtableId = linkIds(f, F.shootDays.parentScheduleId)[0];
      const schedule = scheduleAirtableId
        ? await prisma.productionSchedulePhase.findUnique({ where: { airtableId: scheduleAirtableId } })
        : null;

      const data = {
        shootDayCode: str(f, F.shootDays.shootDayId),
        date: toDate(str(f, F.shootDays.date)),
        seasonShootDay: num(f, F.shootDays.seasonShootDay),
        episodeDay: num(f, F.shootDays.episodeDay),
        dayOfWeek: str(f, F.shootDays.dayOfWeek),
        location: str(f, F.shootDays.location),
        planningNote: str(f, F.shootDays.planningNote),
        projectId: project.id,
        unitProductionId: unit?.id ?? null,
        parentScheduleId: schedule?.id ?? null,
      };
      await prisma.shootDay.upsert({
        where: { airtableId: r.id },
        update: data,
        create: { airtableId: r.id, ...data },
      });
    }

    const summary: SyncSummary = {
      projects: realProjects.length,
      unitProductions: unitRecords.length,
      schedulePhases: scheduleRecords.length,
      shootDays: dayRecords.length,
      locations: locationRecords.length,
      people: contactRecords.length,
    };

    await prisma.syncLog.create({
      data: {
        tableName: "all",
        direction: "pull",
        status: "success",
        recordsProcessed:
          summary.projects +
          summary.unitProductions +
          summary.schedulePhases +
          summary.shootDays +
          summary.locations +
          summary.people,
        startedAt,
        finishedAt: new Date(),
      },
    });

    return summary;
  } catch (err) {
    await prisma.syncLog.create({
      data: {
        tableName: "all",
        direction: "pull",
        status: "error",
        message: err instanceof Error ? err.message : String(err),
        startedAt,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}
