"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { SchedulingError } from "@/lib/scheduling/variations";
import * as variations from "@/lib/scheduling/variations";
import * as requirements from "@/lib/scheduling/requirements";
import * as assignments from "@/lib/scheduling/assignments";
import * as master from "@/lib/scheduling/master";
import {
  parseScheduleDate,
  formatScheduleDate,
  addCalendarDays,
  isProductionDay,
} from "@/lib/scheduling/work-calendar";
import type { ShiftUnit } from "@/lib/scheduling/work-calendar";
import { loadWorkCalendarContext } from "@/lib/scheduling/context";
import { requirementLabel, type ScheduleWindowAssignment } from "@/lib/scheduling/queries";

// Thin wrappers over src/lib/scheduling/*. No business logic lives here —
// keeping it in the service layer is what lets the same code back a separate
// Scheduling deployment later without a rewrite.

export type ActionState = { status: "idle" } | { status: "error"; message: string };

function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function int(fd: FormData, name: string): number | null {
  const v = str(fd, name);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function date(fd: FormData, name: string): Date | null {
  const v = str(fd, name);
  return v ? parseScheduleDate(v) : null;
}

/** Surface SchedulingError text to the user; let anything else bubble. */
async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof SchedulingError) return { ok: false, message: err.message };
    throw err;
  }
}

function revalidateScheduling(variationId?: string | null) {
  revalidatePath("/schedule");
  revalidatePath("/schedule/master");
  if (variationId) revalidatePath(`/schedule/v/${variationId}`);
}

// ---------------------------------------------------------------------------
// Variations
// ---------------------------------------------------------------------------

export async function createVariationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const name = str(formData, "name");
  if (!name) return { status: "error", message: "Give the variation a name." };

  const mode = (str(formData, "mode") ?? "BLANK") as variations.CreateVariationMode;
  const result = await run(() =>
    variations.createVariation({
      name,
      description: str(formData, "description"),
      mode,
      sourceVariationId: str(formData, "sourceVariationId"),
      createdById: user.id,
    })
  );
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/schedule");
  redirect(`/schedule/v/${result.value.id}`);
}

export async function renameVariationAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "variationId");
  const name = str(formData, "name");
  if (!id || !name) return;
  await run(() => variations.renameVariation(id, name, str(formData, "description")));
  revalidateScheduling(id);
}

export async function archiveVariationAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "variationId");
  if (!id) return;
  await run(() => variations.archiveVariation(id));
  revalidateScheduling(id);
  redirect("/schedule");
}

export async function deleteVariationAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "variationId");
  if (!id) return;
  await run(() => variations.deleteVariation(id));
  revalidatePath("/schedule");
  redirect("/schedule");
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export async function createUnitRequirementAction(formData: FormData) {
  await requireUser();
  const projectId = str(formData, "projectId");
  const unitProductionId = str(formData, "unitProductionId");
  const durationDays = int(formData, "durationDays") ?? 5;
  if (!projectId || !unitProductionId) return;
  await run(() => requirements.createUnitRequirement({ projectId, unitProductionId, durationDays }));
  revalidateScheduling(str(formData, "variationId"));
  revalidatePath(`/projects/${projectId}`);
}

export async function createEventRequirementAction(formData: FormData) {
  await requireUser();
  const projectId = str(formData, "projectId");
  const eventTypeId = str(formData, "eventTypeId");
  if (!projectId || !eventTypeId) return;
  await run(() =>
    requirements.createEventRequirement({
      projectId,
      eventTypeId,
      durationDays: int(formData, "durationDays"),
      label: str(formData, "label"),
    })
  );
  revalidateScheduling(str(formData, "variationId"));
  revalidatePath(`/projects/${projectId}`);
}

export async function updateRequirementAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "requirementId");
  const durationDays = int(formData, "durationDays");
  if (!id || durationDays === null) return;
  await run(() => requirements.updateRequirement(id, { durationDays }));
  revalidateScheduling(str(formData, "variationId"));
}

export async function deleteRequirementAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "requirementId");
  if (!id) return;
  await run(() => requirements.deleteRequirement(id));
  revalidateScheduling(str(formData, "variationId"));
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function assignAction(formData: FormData) {
  await requireUser();
  const variationId = str(formData, "variationId");
  const requirementId = str(formData, "requirementId");
  const startDate = date(formData, "startDate");
  if (!variationId || !requirementId || !startDate) return;

  await run(() =>
    assignments.assign({
      variationId,
      requirementId,
      startDate,
      durationDays: int(formData, "durationDays") ?? undefined,
    })
  );
  revalidateScheduling(variationId);
}

export async function moveAssignmentAction(formData: FormData) {
  await requireUser();
  const assignmentId = str(formData, "assignmentId");
  const startDate = date(formData, "startDate");
  if (!assignmentId || !startDate) return;
  await run(() => assignments.move(assignmentId, startDate));
  revalidateScheduling(str(formData, "variationId"));
}

export async function resizeAssignmentAction(formData: FormData) {
  await requireUser();
  const assignmentId = str(formData, "assignmentId");
  const durationDays = int(formData, "durationDays");
  if (!assignmentId || durationDays === null) return;
  await run(() => assignments.resize(assignmentId, durationDays));
  revalidateScheduling(str(formData, "variationId"));
}

export async function unassignAction(formData: FormData) {
  await requireUser();
  const assignmentId = str(formData, "assignmentId");
  if (!assignmentId) return;
  await run(() => assignments.unassign(assignmentId));
  revalidateScheduling(str(formData, "variationId"));
}

export async function applyShiftAction(formData: FormData) {
  await requireUser();
  const variationId = str(formData, "variationId");
  const amount = int(formData, "amount");
  if (!variationId || amount === null) return;

  const unit = (str(formData, "unit") ?? "CALENDAR_DAYS") as ShiftUnit;
  const projectIds = formData.getAll("projectIds").map(String).filter(Boolean);

  await run(() =>
    assignments.applyShift({
      variationId,
      scope: projectIds.length > 0 ? { kind: "SELECTED_PROJECTS", projectIds } : { kind: "ENTIRE_VARIATION" },
      amount,
      unit,
    })
  );
  revalidateScheduling(variationId);
}

// ---------------------------------------------------------------------------
// Master
// ---------------------------------------------------------------------------

export async function pushToMasterAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const variationId = str(formData, "variationId");
  if (!variationId) return { status: "error", message: "No variation selected." };

  const projectIds = formData.getAll("projectIds").map(String).filter(Boolean);
  const result = await run(() =>
    master.pushToMaster({
      variationId,
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      publishedById: user.id,
      note: str(formData, "note"),
    })
  );
  if (!result.ok) return { status: "error", message: result.message };

  revalidateScheduling(variationId);
  redirect("/schedule/master?published=1");
}

export type EdgeMoveResult =
  | { ok: true; startDate: string; endDate: string; durationDays: number }
  | { ok: false; message: string };

/**
 * Typed move for the calendar's drag-and-drop, which has real values in hand
 * and no form to serialise through. Returns the resolved dates so the client
 * can reconcile its optimistic state with what the work calendar actually
 * decided — dropping on a Saturday snaps forward, and the UI must show that.
 */
export async function moveAssignmentToDate(input: {
  assignmentId: string;
  variationId: string;
  isoDate: string;
}): Promise<EdgeMoveResult> {
  await requireUser();
  const result = await run(() =>
    assignments.move(input.assignmentId, parseScheduleDate(input.isoDate))
  );
  if (!result.ok) return { ok: false, message: result.message };

  revalidateScheduling(input.variationId);
  return {
    ok: true,
    startDate: formatScheduleDate(result.value.startDate),
    endDate: formatScheduleDate(result.value.endDate),
    durationDays: result.value.durationDays,
  };
}

/**
 * Typed edge-drags for the timeline. Both take the date the cursor landed on
 * and let the engine decide what that means: the client never converts a
 * pixel offset into a duration, because "how many production days is that"
 * is a work-calendar question and there is exactly one place that answers it.
 */
export async function resizeAssignmentToEnd(input: {
  assignmentId: string;
  variationId: string;
  isoDate: string;
}): Promise<EdgeMoveResult> {
  await requireUser();
  const result = await run(() =>
    assignments.resizeToEndDate(input.assignmentId, parseScheduleDate(input.isoDate))
  );
  if (!result.ok) return { ok: false, message: result.message };
  revalidateScheduling(input.variationId);
  return {
    ok: true,
    startDate: formatScheduleDate(result.value.startDate),
    endDate: formatScheduleDate(result.value.endDate),
    durationDays: result.value.durationDays,
  };
}

export async function resizeAssignmentFromStart(input: {
  assignmentId: string;
  variationId: string;
  isoDate: string;
}): Promise<EdgeMoveResult> {
  await requireUser();
  const result = await run(() =>
    assignments.resizeToStartDate(input.assignmentId, parseScheduleDate(input.isoDate))
  );
  if (!result.ok) return { ok: false, message: result.message };
  revalidateScheduling(input.variationId);
  return {
    ok: true,
    startDate: formatScheduleDate(result.value.startDate),
    endDate: formatScheduleDate(result.value.endDate),
    durationDays: result.value.durationDays,
  };
}

// ---------------------------------------------------------------------------
// Merged Master preview — a visual "what would Master look like" for the
// push form. Read-only, by construction: it calls the same previewMergedMaster
// used for the tabular before/after summary, then shapes it into the same
// window/assignment/non-working-day shape the Gantt already knows how to draw.
// ---------------------------------------------------------------------------

export interface MergedMasterPreviewResult {
  windowStart: string;
  windowEnd: string;
  nonWorkingDays: string[];
  incomingIds: string[];
  assignments: (Omit<ScheduleWindowAssignment, "startDate" | "endDate"> & {
    startDate: string;
    endDate: string;
  })[];
}

export async function loadMergedMasterPreview(input: {
  variationId: string;
  projectIds?: string[];
}): Promise<MergedMasterPreviewResult> {
  await requireUser();
  const rows = await master.previewMergedMaster(input);

  if (rows.length === 0) {
    return { windowStart: "", windowEnd: "", nonWorkingDays: [], incomingIds: [], assignments: [] };
  }

  // Pad to whole months so the header ticks line up cleanly, same as the
  // main timeline's own window math.
  const minStart = rows.reduce((a, r) => (r.startDate < a ? r.startDate : a), rows[0].startDate);
  const maxEnd = rows.reduce((a, r) => (r.endDate > a ? r.endDate : a), rows[0].endDate);
  const windowStart = new Date(Date.UTC(minStart.getUTCFullYear(), minStart.getUTCMonth(), 1));
  const windowEnd = new Date(Date.UTC(maxEnd.getUTCFullYear(), maxEnd.getUTCMonth() + 1, 0));

  const masterVariation = await variations.getMasterVariation();
  const ctx = await loadWorkCalendarContext(masterVariation.id);
  const nonWorkingDays: string[] = [];
  for (let d = windowStart; d <= windowEnd; d = addCalendarDays(d, 1)) {
    if (!isProductionDay(d, ctx)) nonWorkingDays.push(formatScheduleDate(d));
  }

  return {
    windowStart: formatScheduleDate(windowStart),
    windowEnd: formatScheduleDate(windowEnd),
    nonWorkingDays,
    incomingIds: rows.filter((r) => r.incoming).map((r) => r.id),
    assignments: rows.map((r) => ({
      id: r.id,
      startDate: formatScheduleDate(r.startDate),
      endDate: formatScheduleDate(r.endDate),
      durationDays: r.durationDays,
      projectId: r.projectId,
      projectName: r.project.name,
      projectColor: r.project.projectColor,
      projectPriority: r.project.priority,
      kind: r.requirement.kind,
      label: requirementLabel(r.requirement),
    })),
  };
}
