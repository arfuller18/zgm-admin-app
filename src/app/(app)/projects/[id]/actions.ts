"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createUnitRequirement } from "@/lib/scheduling/requirements";
import type {
  ProjectFormat,
  ProjectStatus,
  Priority,
  ProjectColor,
  ProjectContactRelation,
  BudgetStatus,
  TaskStatus,
  TaskPriority,
} from "../../../../../generated/prisma/enums";

function str(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function int(formData: FormData, name: string): number | null {
  const v = str(formData, name);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function decimal(formData: FormData, name: string): number | null {
  const v = str(formData, name);
  if (v === null) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function dateVal(formData: FormData, name: string): Date | null {
  const v = str(formData, name);
  if (v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function enumVal<T extends string>(formData: FormData, name: string, allowed: readonly T[]): T | null {
  const v = str(formData, name);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

const PROJECT_FORMATS: ProjectFormat[] = [
  "SERIES",
  "FEATURE",
  "LIMITED_SERIES",
  "UNSCRIPTED",
  "DOCUMENTARY",
  "CO_PRO",
  "SHORT_DIGITAL",
  "OTHER",
];
const PROJECT_STATUSES: ProjectStatus[] = [
  "IDEA",
  "SUBMISSION",
  "OPTIONED",
  "SCRIPT",
  "PACKAGING",
  "FINANCING",
  "GREENLIGHT_READY",
  "PREP",
  "PAUSED",
];
const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW", "WATCH"];
const PROJECT_COLORS: ProjectColor[] = ["PINK", "PURPLE", "BLUE", "GREEN", "YELLOW", "ORANGE", "RED"];
const CONTACT_RELATIONS: ProjectContactRelation[] = [
  "EXECUTIVE_OWNER",
  "DAY_TO_DAY_OWNER",
  "SHOWRUNNER",
  "KEY_TALENT",
  "KEY_CREW",
  "IMPORTANT_CONTACT",
];
const BUDGET_STATUSES: BudgetStatus[] = ["DRAFT", "FINAL"];
const TASK_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"];
const TASK_PRIORITIES: TaskPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export type ProjectFormState = { status: "idle" } | { status: "error"; message: string };

export async function updateProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireUser();

  const name = str(formData, "name");
  if (!name) return { status: "error", message: "Project name is required." };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      projectCode: str(formData, "projectCode"),
      format: enumVal(formData, "format", PROJECT_FORMATS),
      genre: str(formData, "genre"),
      projectColor: enumVal(formData, "projectColor", PROJECT_COLORS),
      seasonFilm: str(formData, "seasonFilm"),
      episodeCount: int(formData, "episodeCount"),
      episodeLength: int(formData, "episodeLength"),
      currentStatus: enumVal(formData, "currentStatus", PROJECT_STATUSES),
      priority: enumVal(formData, "priority", PRIORITIES),
      rightsStatus: str(formData, "rightsStatus"),
      rightsExpiration: dateVal(formData, "rightsExpiration"),
      scriptStatus: str(formData, "scriptStatus"),
      salesDistributionStatus: str(formData, "salesDistributionStatus"),
      salesDistributionNotes: str(formData, "salesDistributionNotes"),
      castingStatus: str(formData, "castingStatus"),
      castingDirector: str(formData, "castingDirector"),
      googleFolderUrl: str(formData, "googleFolderUrl"),
      decksBiblesUrl: str(formData, "decksBiblesUrl"),
      additionalLinks: str(formData, "additionalLinks"),
      logline: str(formData, "logline"),
      whyZgm: str(formData, "whyZgm"),
      audienceHook: str(formData, "audienceHook"),
      biggestRisk: str(formData, "biggestRisk"),
      nextDecision: str(formData, "nextDecision"),
      nextAction: str(formData, "nextAction"),
      nextActionDueDate: dateVal(formData, "nextActionDueDate"),
      taxCreditNotes: str(formData, "taxCreditNotes"),
      additionalNotes: str(formData, "additionalNotes"),
      zgmOwner: str(formData, "zgmOwner"),
      mainContactRole: str(formData, "mainContactRole"),
    },
  });

  redirect(`/projects/${projectId}`);
}

// ---------- Project <-> Person relations (Showrunner, Key Talent, etc.) ----------

export async function addProjectContact(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  const relation = enumVal(formData, "relation", CONTACT_RELATIONS);
  if (!projectId || !personId || !relation) return;

  await prisma.projectContact.upsert({
    where: { projectId_personId_relation: { projectId, personId, relation } },
    update: {},
    create: { projectId, personId, relation },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectContact(formData: FormData) {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!contactId) return;
  await prisma.projectContact.delete({ where: { id: contactId } });
  revalidatePath(`/projects/${projectId}`);
}

// ---------- Budgets ----------

export async function createBudget(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const name = str(formData, "name");
  if (!projectId || !name) return;

  await prisma.budget.create({
    data: {
      projectId,
      name,
      totalBudget: decimal(formData, "totalBudget"),
      budgetPerEpisode: decimal(formData, "budgetPerEpisode"),
      status: enumVal(formData, "status", BUDGET_STATUSES),
      budgetSheetsLink: str(formData, "budgetSheetsLink"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateBudget(formData: FormData) {
  await requireUser();
  const budgetId = String(formData.get("budgetId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const name = str(formData, "name");
  if (!budgetId || !name) return;

  await prisma.budget.update({
    where: { id: budgetId },
    data: {
      name,
      totalBudget: decimal(formData, "totalBudget"),
      budgetPerEpisode: decimal(formData, "budgetPerEpisode"),
      status: enumVal(formData, "status", BUDGET_STATUSES),
      budgetSheetsLink: str(formData, "budgetSheetsLink"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteBudget(formData: FormData) {
  await requireUser();
  const budgetId = String(formData.get("budgetId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!budgetId) return;
  await prisma.budget.delete({ where: { id: budgetId } });
  revalidatePath(`/projects/${projectId}`);
}

// ---------- Tasks ----------

export async function createTask(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const unitProductionId = str(formData, "unitProductionId");
  const title = str(formData, "title");
  if (!projectId || !title) return;

  await prisma.task.create({
    data: {
      projectId,
      unitProductionId,
      title,
      status: enumVal(formData, "status", TASK_STATUSES) ?? "NOT_STARTED",
      priority: enumVal(formData, "priority", TASK_PRIORITIES),
      dueDate: dateVal(formData, "dueDate"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTaskStatus(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const status = enumVal(formData, "status", TASK_STATUSES);
  if (!taskId || !status) return;
  await prisma.task.update({ where: { id: taskId }, data: { status } });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!taskId) return;
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${projectId}`);
}

// ---------- Unit Productions ----------

export async function createUnitProduction(formData: FormData) {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const name = str(formData, "name");
  if (!projectId || !name) return;

  const unit = await prisma.unitProduction.create({
    data: {
      projectId,
      name,
      season: int(formData, "season"),
      episode: int(formData, "episode"),
    },
  });

  // Without this, a new unit production never appears anywhere in
  // Scheduling — unscheduledItems() is driven entirely by requirements, not
  // by UnitProduction rows directly. 5 days matches the manual "Add to
  // schedule" form's own default; a scheduler can change it from either the
  // unscheduled drawer or this project's Scheduling tab at any time.
  await createUnitRequirement({ projectId, unitProductionId: unit.id, durationDays: 5 });
  revalidatePath("/schedule");
  revalidatePath("/schedule/master");

  redirect(`/projects/${projectId}/units/${unit.id}`);
}

export async function archiveUnitProduction(formData: FormData) {
  await requireUser();
  const unitId = String(formData.get("unitId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const archived = formData.get("archived") === "true";
  if (!unitId) return;
  await prisma.unitProduction.update({ where: { id: unitId }, data: { archived } });
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/units/${unitId}`);
}

export async function deleteUnitProduction(formData: FormData) {
  await requireUser();
  const unitId = String(formData.get("unitId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!unitId) return;
  await prisma.unitProduction.delete({ where: { id: unitId } });
  redirect(`/projects/${projectId}?tab=episodes`);
}
