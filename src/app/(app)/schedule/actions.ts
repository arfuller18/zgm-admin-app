"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { SchedulingError } from "@/lib/scheduling/variations";
import * as variations from "@/lib/scheduling/variations";
import * as requirements from "@/lib/scheduling/requirements";
import * as assignments from "@/lib/scheduling/assignments";
import * as master from "@/lib/scheduling/master";
import * as conflicts from "@/lib/scheduling/conflicts";
import {
  parseScheduleDate,
  formatScheduleDate,
  addCalendarDays,
  isProductionDay,
} from "@/lib/scheduling/work-calendar";
import type { ShiftUnit } from "@/lib/scheduling/work-calendar";
import { loadWorkCalendarContext } from "@/lib/scheduling/context";
import {
  requirementLabel,
  getAssignmentDisplay,
  loadMonthGrid,
  type ScheduleWindowAssignment,
} from "@/lib/scheduling/queries";

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
  const includedProjectIds = formData.getAll("includedProjectIds").map(String).filter(Boolean);
  const result = await run(() =>
    variations.createVariation({
      name,
      description: str(formData, "description"),
      mode,
      sourceVariationId: str(formData, "sourceVariationId"),
      createdById: user.id,
      includedProjectIds,
    })
  );
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/schedule");
  redirect(`/schedule/v/${result.value.id}`);
}

/**
 * Typed, like addIncludedProjectAction below — called directly from the
 * inline rename control rather than through a <form>, so it needs the
 * result back immediately to know whether to close the editor or show an
 * error. description is required (not optional) specifically so a
 * name-only rename can't accidentally clear it — renameVariation() treats
 * an omitted description as "set to null," not "leave alone."
 */
export async function renameVariationAction(input: {
  variationId: string;
  name: string;
  description: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireUser();
  const result = await run(() =>
    variations.renameVariation(input.variationId, input.name, input.description)
  );
  if (!result.ok) return result;
  revalidateScheduling(input.variationId);
  return { ok: true };
}

/**
 * Typed toggles for the "Manage projects" control, which needs the result
 * back immediately to update its own checkbox state — a bare form action
 * would work too, but this one lives inside a dropdown, not a <form>.
 */
export async function addIncludedProjectAction(input: {
  variationId: string;
  projectId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireUser();
  const result = await run(() => variations.addIncludedProject(input.variationId, input.projectId));
  if (!result.ok) return result;
  revalidateScheduling(input.variationId);
  return { ok: true };
}

export async function removeIncludedProjectAction(input: {
  variationId: string;
  projectId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireUser();
  const result = await run(() => variations.removeIncludedProject(input.variationId, input.projectId));
  if (!result.ok) return result;
  revalidateScheduling(input.variationId);
  return { ok: true };
}

export async function archiveVariationAction(formData: FormData) {
  await requireUser();
  const id = str(formData, "variationId");
  if (!id) return;
  await run(() => variations.archiveVariation(id));
  revalidateScheduling(id);
  redirect("/schedule");
}

/**
 * The Master Calendar's own "edit" button, in effect: Master itself can't be
 * dragged, resized, or dropped onto (see CalendarMonth's readOnly prop) — the
 * only way to change it is to plan the change in a copy and publish that
 * copy back. This is the one-click version of that copy step, invoked from
 * the prompt that intercepts an attempted edit on Master.
 */
export async function createVariationFromMasterAction(): Promise<
  { ok: true; id: string } | { ok: false; message: string }
> {
  const user = await requireUser();
  const result = await run(() =>
    variations.createVariation({
      name: `Master copy — ${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
      mode: "COPY_MASTER",
      createdById: user.id,
    })
  );
  if (!result.ok) return result;
  revalidatePath("/schedule");
  return { ok: true, id: result.value.id };
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

/**
 * Remove a project's placements from the Master Calendar. Soft, same as
 * unassign(): requirements return to unscheduled, nothing is deleted. Uses
 * ActionState (rather than a bare form action) because this acts on the
 * live schedule and a silently-swallowed error here would be the wrong kind
 * of quiet.
 */
export async function removeProjectFromMasterAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const projectId = str(formData, "projectId");
  if (!projectId) return { status: "error", message: "No project specified." };

  const master = await variations.getMasterVariation();
  const result = await run(() => assignments.removeProjectFromVariation(master.id, projectId));
  if (!result.ok) return { status: "error", message: result.message };

  revalidateScheduling(master.id);
  return { status: "idle" };
}

/** Unschedule everything on Master. Same soft semantics as above, just
 * every project instead of one. */
export async function clearMasterAction(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  await requireUser();
  const master = await variations.getMasterVariation();
  const result = await run(() => assignments.clearVariation(master.id));
  if (!result.ok) return { status: "error", message: result.message };

  revalidateScheduling(master.id);
  return { status: "idle" };
}

/**
 * The four ways to scope a bulk shift, serialisable across the client/server
 * boundary (dates as ISO strings — `assignments.ShiftScope` wants real Dates,
 * so `toServiceScope` below is the one place that converts).
 */
export type ShiftScopeInput =
  | { kind: "ENTIRE_VARIATION" }
  | { kind: "SELECTED_PROJECTS"; projectIds: string[] }
  | { kind: "SELECTED_ASSIGNMENTS"; assignmentIds: string[] }
  | { kind: "DATE_RANGE"; from: string; to: string };

function toServiceScope(scope: ShiftScopeInput): assignments.ShiftScope {
  if (scope.kind === "DATE_RANGE") {
    return { kind: "DATE_RANGE", from: parseScheduleDate(scope.from), to: parseScheduleDate(scope.to) };
  }
  return scope;
}

export interface ShiftPreviewRowView {
  assignmentId: string;
  projectName: string;
  label: string;
  fromStart: string;
  fromEnd: string;
  toStart: string;
  toEnd: string;
  durationDays: number;
}

export type ShiftPreviewResult =
  | { ok: true; rows: ShiftPreviewRowView[] }
  | { ok: false; message: string };

export type ShiftApplyResult = { ok: true; moved: number } | { ok: false; message: string };

function shiftRowsToView(rows: Awaited<ReturnType<typeof assignments.previewShift>>): ShiftPreviewRowView[] {
  return rows.map((r) => ({
    assignmentId: r.assignmentId,
    projectName: r.projectName,
    label: r.label,
    fromStart: formatScheduleDate(r.from.startDate),
    fromEnd: formatScheduleDate(r.from.endDate),
    toStart: formatScheduleDate(r.to.startDate),
    toEnd: formatScheduleDate(r.to.endDate),
    durationDays: r.durationDays,
  }));
}

/** What a shift would do. No write path — same preview-before-consequence
 * pattern as pushToMaster. */
export async function previewShiftAction(input: {
  variationId: string;
  scope: ShiftScopeInput;
  amount: number;
  unit: ShiftUnit;
}): Promise<ShiftPreviewResult> {
  await requireUser();
  const result = await run(() =>
    assignments.previewShift({
      variationId: input.variationId,
      scope: toServiceScope(input.scope),
      amount: input.amount,
      unit: input.unit,
    })
  );
  if (!result.ok) return result;
  return { ok: true, rows: shiftRowsToView(result.value) };
}

/**
 * Apply a previously previewed shift. Takes the same scope/amount/unit the
 * client already ran through previewShiftAction — the preview rows already
 * on screen are the confirmation of what moved, so this only needs to report
 * the count and whether it succeeded.
 */
export async function applyShiftTyped(input: {
  variationId: string;
  scope: ShiftScopeInput;
  amount: number;
  unit: ShiftUnit;
}): Promise<ShiftApplyResult> {
  await requireUser();
  const result = await run(() =>
    assignments.applyShift({
      variationId: input.variationId,
      scope: toServiceScope(input.scope),
      amount: input.amount,
      unit: input.unit,
    })
  );
  if (!result.ok) return result;
  revalidateScheduling(input.variationId);
  return { ok: true, moved: result.value.moved };
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

export interface ScheduleConflictView {
  projectName: string;
  label: string;
  locationName: string;
  startDate: string;
  endDate: string;
}

export type EdgeMoveResult =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      durationDays: number;
      /**
       * Other placements sharing this assignment's location on overlapping
       * dates, if it has a location set. Never blocks the move — it already
       * happened — this is purely informational, same spirit as the
       * People/Location booking-conflict warnings elsewhere in the app.
       */
      conflicts: ScheduleConflictView[];
    }
  | { ok: false; message: string };

/** Location conflicts for an assignment as it now stands, empty if it has
 * no location or nothing else overlaps it. */
async function checkLocationConflicts(assignment: {
  id: string;
  variationId: string;
  projectId: string;
  locationId: string | null;
  startDate: Date;
  endDate: Date;
}): Promise<ScheduleConflictView[]> {
  if (!assignment.locationId) return [];
  const rows = await conflicts.findLocationConflicts({
    variationId: assignment.variationId,
    locationId: assignment.locationId,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    excludeAssignmentId: assignment.id,
    excludeProjectId: assignment.projectId,
  });
  return rows.map((r) => ({
    projectName: r.projectName,
    label: r.label,
    locationName: r.locationName,
    startDate: formatScheduleDate(r.startDate),
    endDate: formatScheduleDate(r.endDate),
  }));
}

export type AssignToDateResult =
  | {
      ok: true;
      assignment: {
        id: string;
        startDate: string;
        endDate: string;
        durationDays: number;
        projectId: string;
        projectName: string;
        projectColor: ScheduleWindowAssignment["projectColor"];
        projectPriority: ScheduleWindowAssignment["projectPriority"];
        kind: ScheduleWindowAssignment["kind"];
        label: string;
      };
      conflicts: ScheduleConflictView[];
    }
  | { ok: false; message: string };

/**
 * Place an unscheduled requirement onto a date — the drawer's drag-onto-
 * calendar action. Distinct from moveAssignmentToDate: there is no existing
 * assignment to update, so the client needs the full row back (project
 * name/color, label) to render a brand-new bar, not just resolved dates.
 */
export async function assignRequirementToDate(input: {
  requirementId: string;
  variationId: string;
  isoDate: string;
}): Promise<AssignToDateResult> {
  await requireUser();
  const result = await run(() =>
    assignments.assign({
      variationId: input.variationId,
      requirementId: input.requirementId,
      startDate: parseScheduleDate(input.isoDate),
    })
  );
  if (!result.ok) return result;

  const display = await getAssignmentDisplay(result.value.id);
  revalidateScheduling(input.variationId);
  return {
    ok: true,
    assignment: {
      ...display,
      startDate: formatScheduleDate(display.startDate),
      endDate: formatScheduleDate(display.endDate),
    },
    conflicts: await checkLocationConflicts(result.value),
  };
}

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
    conflicts: await checkLocationConflicts(result.value),
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
    conflicts: await checkLocationConflicts(result.value),
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
    conflicts: await checkLocationConflicts(result.value),
  };
}

/**
 * Typed duration resize for the calendar block popover — the precise-entry
 * counterpart to dragging an edge. Same return shape as the edge-drag
 * actions so the client reconciles it the same way.
 */
export async function resizeAssignmentDuration(input: {
  assignmentId: string;
  variationId: string;
  durationDays: number;
}): Promise<EdgeMoveResult> {
  await requireUser();
  const result = await run(() => assignments.resize(input.assignmentId, input.durationDays));
  if (!result.ok) return { ok: false, message: result.message };
  revalidateScheduling(input.variationId);
  return {
    ok: true,
    startDate: formatScheduleDate(result.value.startDate),
    endDate: formatScheduleDate(result.value.endDate),
    durationDays: result.value.durationDays,
    conflicts: await checkLocationConflicts(result.value),
  };
}

/**
 * Typed unassign for the calendar block popover's delete button. Same soft
 * semantics as unassignAction (the requirement returns to unscheduled,
 * nothing is destroyed) — typed so the client can remove the block from its
 * own local state without a full page reload.
 */
export async function unassignAssignmentTyped(input: {
  assignmentId: string;
  variationId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireUser();
  const result = await run(() => assignments.unassign(input.assignmentId));
  if (!result.ok) return result;
  revalidateScheduling(input.variationId);
  return { ok: true };
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

// ---------------------------------------------------------------------------
// Push-to-Master location conflicts — the safety check that belongs right
// where a variation is about to become real, alongside the "this project
// already has a Master schedule" warning previewPush already surfaces.
// ---------------------------------------------------------------------------

export interface PushLocationConflictView {
  incomingProjectName: string;
  incomingLabel: string;
  locationName: string;
  conflictsWith: { projectName: string; label: string; startDate: string; endDate: string }[];
}

export async function previewPushConflictsAction(input: {
  variationId: string;
  projectIds?: string[];
}): Promise<PushLocationConflictView[]> {
  await requireUser();
  const rows = await master.previewPushConflicts(input);
  return rows.map((r) => ({
    incomingProjectName: r.incomingProjectName,
    incomingLabel: r.incomingLabel,
    locationName: r.locationName,
    conflictsWith: r.conflictsWith.map((c) => ({
      projectName: c.projectName,
      label: c.label,
      startDate: formatScheduleDate(c.startDate),
      endDate: formatScheduleDate(c.endDate),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Infinite-scroll calendar — one additional month at a time, called as the
// user scrolls near either edge of what's already loaded.
// ---------------------------------------------------------------------------

/** "YYYY-MM" → the first of that month, UTC. */
function parseMonthParam(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export async function loadCalendarMonthAction(input: {
  variationId: string;
  month: string; // "YYYY-MM"
  projectId?: string;
}) {
  await requireUser();
  const ctx = await loadWorkCalendarContext(input.variationId);
  return loadMonthGrid({
    variationId: input.variationId,
    monthStart: parseMonthParam(input.month),
    projectId: input.projectId,
    ctx,
  });
}
