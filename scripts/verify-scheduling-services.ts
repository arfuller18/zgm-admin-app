import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  parseScheduleDate as d,
  formatScheduleDate as f,
  addCalendarDays,
} from "../src/lib/scheduling/work-calendar";
import {
  getMasterVariation,
  createVariation,
  deleteVariation,
} from "../src/lib/scheduling/variations";
import { createUnitRequirement } from "../src/lib/scheduling/requirements";
import {
  assign,
  move,
  resize,
  resizeToStartDate,
  unassign,
  previewShift,
  applyShift,
} from "../src/lib/scheduling/assignments";
import { previewPush, pushToMaster } from "../src/lib/scheduling/master";

// Integration checks for the guarantees the whole model rests on: variation
// isolation, Master isolation, and partial-push safety.
//
// Runs against the real development database but confines itself to one
// throwaway project, which is also how it proves partial pushes leave other
// productions alone. Everything is removed at the end.
//
//   npx tsx scripts/verify-scheduling-services.ts

const TEST_PROJECT = "ZZZ Scheduling Verification";
let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

async function cleanup() {
  const p = await prisma.project.findFirst({ where: { name: TEST_PROJECT } });
  if (p) await prisma.project.delete({ where: { id: p.id } }); // cascades everywhere
  await prisma.scheduleVariation.deleteMany({
    where: { kind: "VARIATION", name: { startsWith: "ZZZ Verify" } },
  });
}

async function main() {
  await cleanup(); // in case a previous run died partway

  const master = await getMasterVariation();

  // Baseline: how much real production data sits on Master. Nothing this
  // script does may change this number.
  const realMasterBefore = await prisma.scheduleAssignment.count({
    where: { variationId: master.id },
  });

  // --- fixtures -----------------------------------------------------------
  const project = await prisma.project.create({
    data: { name: TEST_PROJECT, currentStatus: "PREP", projectColor: "BLUE" },
  });
  const ep1 = await prisma.unitProduction.create({
    data: { projectId: project.id, name: "ZZZ Ep 1", episode: 1 },
  });
  const ep2 = await prisma.unitProduction.create({
    data: { projectId: project.id, name: "ZZZ Ep 2", episode: 2 },
  });
  const req1 = await createUnitRequirement({
    projectId: project.id,
    unitProductionId: ep1.id,
    durationDays: 5,
  });
  const req2 = await createUnitRequirement({
    projectId: project.id,
    unitProductionId: ep2.id,
    durationDays: 5,
  });

  console.log("\nRequirement lifecycle");
  check("a new requirement starts unscheduled", () => {
    assert.equal(req1.status, "DRAFT");
  });

  // --- variation A --------------------------------------------------------
  const varA = await createVariation({ name: "ZZZ Verify A", mode: "BLANK" });
  const a1 = await assign({
    variationId: varA.id,
    requirementId: req1.id,
    startDate: d("2027-03-01"), // a Monday
  });
  await assign({ variationId: varA.id, requirementId: req2.id, startDate: d("2027-03-08") });

  console.log("\nAssignment");
  check("assigning derives the end date from the duration", () => {
    assert.equal(f(a1.startDate), "2027-03-01");
    assert.equal(f(a1.endDate), "2027-03-05"); // Mon–Fri
  });
  const req1AfterAssign = await prisma.schedulingRequirement.findUniqueOrThrow({
    where: { id: req1.id },
  });
  check("a placed requirement reads SCHEDULED_IN_VARIATION, not ON_MASTER", () => {
    assert.equal(req1AfterAssign.status, "SCHEDULED_IN_VARIATION");
  });

  // --- variation isolation ------------------------------------------------
  const varB = await createVariation({
    name: "ZZZ Verify B",
    mode: "DUPLICATE",
    sourceVariationId: varA.id,
  });
  const bAssignments = await prisma.scheduleAssignment.findMany({
    where: { variationId: varB.id },
    orderBy: { startDate: "asc" },
  });

  console.log("\nVariation isolation");
  check("duplicating copies every placement", () => {
    assert.equal(bAssignments.length, 2);
    assert.equal(f(bAssignments[0].startDate), "2027-03-01");
  });
  check("the duplicate points at the same requirements, not copies of them", () => {
    assert.deepEqual(
      bAssignments.map((x) => x.requirementId).sort(),
      [req1.id, req2.id].sort()
    );
  });
  check("legacyPhaseId is not copied (it is unique to the backfilled row)", () => {
    assert.equal(bAssignments.every((x) => x.legacyPhaseId === null), true);
  });

  await move(bAssignments[0].id, d("2027-06-07"));
  const aAfterBMove = await prisma.scheduleAssignment.findUniqueOrThrow({ where: { id: a1.id } });
  check("moving in B does not move A", () => {
    assert.equal(f(aAfterBMove.startDate), "2027-03-01");
  });
  const bMoved = await prisma.scheduleAssignment.findUniqueOrThrow({
    where: { id: bAssignments[0].id },
  });
  check("B's moved block still spans 5 production days", () => {
    assert.equal(f(bMoved.startDate), "2027-06-07");
    assert.equal(f(bMoved.endDate), "2027-06-11");
    assert.equal(bMoved.durationDays, 5);
  });

  await resize(bAssignments[0].id, 8);
  const reqAfterResize = await prisma.schedulingRequirement.findUniqueOrThrow({
    where: { id: req1.id },
  });
  check("resizing in a variation does not rewrite the project's stated need", () => {
    assert.equal(reqAfterResize.durationDays, 5);
  });

  const bAfterResize = await prisma.scheduleAssignment.findUniqueOrThrow({
    where: { id: bAssignments[0].id },
  });
  // Same weekday, one calendar week earlier — on a Mon–Fri calendar that is
  // exactly one full production week, so the assertion below is exact, not
  // approximate.
  const startOneWeekEarlier = addCalendarDays(bAfterResize.startDate, -7);
  await resizeToStartDate(bAssignments[0].id, startOneWeekEarlier);
  const bAfterStartResize = await prisma.scheduleAssignment.findUniqueOrThrow({
    where: { id: bAssignments[0].id },
  });
  check("dragging the start edge back one week adds exactly 5 production days", () => {
    assert.equal(bAfterStartResize.durationDays, bAfterResize.durationDays + 5);
    assert.equal(f(bAfterStartResize.startDate), f(startOneWeekEarlier));
  });
  check("dragging the start edge leaves the end date untouched", () => {
    assert.equal(f(bAfterStartResize.endDate), f(bAfterResize.endDate));
  });

  console.log("\nMaster isolation");
  const masterDuringPlanning = await prisma.scheduleAssignment.count({
    where: { variationId: master.id, projectId: project.id },
  });
  check("planning in a variation puts nothing on Master", () => {
    assert.equal(masterDuringPlanning, 0);
  });

  // --- overlap ------------------------------------------------------------
  console.log("\nOverlap");
  const overlapping = await assign({
    variationId: varA.id,
    requirementId: req2.id,
    startDate: d("2027-03-01"), // deliberately on top of req1's block
  });
  check("two productions may occupy the same dates", () => {
    assert.equal(f(overlapping.startDate), "2027-03-01");
  });
  await unassign(overlapping.id);

  // --- preview purity -----------------------------------------------------
  console.log("\nPreview");
  const beforePreview = await prisma.scheduleAssignment.findMany({
    where: { variationId: varA.id },
    orderBy: { startDate: "asc" },
  });
  const shiftPreview = await previewShift({
    variationId: varA.id,
    scope: { kind: "ENTIRE_VARIATION" },
    amount: 14,
    unit: "CALENDAR_DAYS",
  });
  const afterPreview = await prisma.scheduleAssignment.findMany({
    where: { variationId: varA.id },
    orderBy: { startDate: "asc" },
  });
  check("previewing a shift changes nothing", () => {
    assert.deepEqual(
      beforePreview.map((x) => f(x.startDate)),
      afterPreview.map((x) => f(x.startDate))
    );
  });
  check("the shift preview reports the new dates", () => {
    assert.equal(shiftPreview.length, 2);
    assert.equal(f(shiftPreview[0].to.startDate), "2027-03-15");
  });

  const pushPreview = await previewPush({ variationId: varA.id, projectIds: [project.id] });
  const masterAfterPushPreview = await prisma.scheduleAssignment.count({
    where: { variationId: master.id },
  });
  check("previewing a push changes nothing on Master", () => {
    assert.equal(masterAfterPushPreview, realMasterBefore);
  });
  check("the push preview flags no clash on a first publish", () => {
    assert.equal(pushPreview.projects[0].conflictsWithExisting, false);
    assert.equal(pushPreview.totalIncoming, 2);
  });

  // --- bulk shift ---------------------------------------------------------
  console.log("\nBulk shift");
  const durationsBefore = beforePreview.map((x) => x.durationDays);
  await applyShift({
    variationId: varA.id,
    scope: { kind: "ENTIRE_VARIATION" },
    amount: 14,
    unit: "CALENDAR_DAYS",
  });
  const shifted = await prisma.scheduleAssignment.findMany({
    where: { variationId: varA.id },
    orderBy: { startDate: "asc" },
  });
  check("a bulk shift moves every placement", () => {
    assert.equal(f(shifted[0].startDate), "2027-03-15");
  });
  check("a bulk shift preserves durations exactly", () => {
    assert.deepEqual(shifted.map((x) => x.durationDays), durationsBefore);
  });

  // --- push ---------------------------------------------------------------
  console.log("\nPush to Master");
  const result = await pushToMaster({ variationId: varA.id, projectIds: [project.id] });
  check("push reports what it did", () => {
    assert.equal(result.added, 2);
    assert.equal(result.replaced, 0);
  });
  const masterTest = await prisma.scheduleAssignment.findMany({
    where: { variationId: master.id, projectId: project.id },
    orderBy: { startDate: "asc" },
  });
  check("the pushed schedule is now on Master", () => {
    assert.equal(masterTest.length, 2);
    assert.equal(f(masterTest[0].startDate), "2027-03-15");
  });
  const realMasterAfterPush = await prisma.scheduleAssignment.count({
    where: { variationId: master.id, projectId: { not: project.id } },
  });
  check("every other project's Master schedule is intact", () => {
    assert.equal(realMasterAfterPush, realMasterBefore);
  });
  const reqAfterPush = await prisma.schedulingRequirement.findUniqueOrThrow({
    where: { id: req1.id },
  });
  check("a published requirement reads ON_MASTER", () => {
    assert.equal(reqAfterPush.status, "ON_MASTER");
  });

  // --- republish / replacement -------------------------------------------
  console.log("\nReplacement");
  const preview2 = await previewPush({ variationId: varB.id, projectIds: [project.id] });
  check("pushing a second variation warns that Master already has this project", () => {
    assert.equal(preview2.projects[0].conflictsWithExisting, true);
    assert.equal(preview2.projects[0].replacing, 2);
  });
  const result2 = await pushToMaster({ variationId: varB.id, projectIds: [project.id] });
  check("republishing replaces rather than duplicates", () => {
    assert.equal(result2.replaced, 2);
  });
  const masterAfterReplace = await prisma.scheduleAssignment.count({
    where: { variationId: master.id, projectId: project.id },
  });
  check("Master holds one schedule for the project, not two", () => {
    assert.equal(masterAfterReplace, 2);
  });
  const stillIntact = await prisma.scheduleAssignment.count({
    where: { variationId: master.id, projectId: { not: project.id } },
  });
  check("replacement still leaves other productions alone", () => {
    assert.equal(stillIntact, realMasterBefore);
  });
  const publications = await prisma.masterPublication.count();
  check("both pushes were recorded in the audit trail", () => {
    assert.equal(publications >= 2, true);
  });

  // --- unscheduling -------------------------------------------------------
  console.log("\nUnscheduling");
  const toRemove = await prisma.scheduleAssignment.findFirstOrThrow({
    where: { variationId: varA.id, requirementId: req2.id },
  });
  await unassign(toRemove.id);
  const req2After = await prisma.schedulingRequirement.findUniqueOrThrow({
    where: { id: req2.id },
  });
  const unitStillThere = await prisma.unitProduction.findUnique({ where: { id: ep2.id } });
  check("removing a placement keeps the requirement", () => {
    assert.notEqual(req2After, null);
  });
  check("removing a placement keeps the unit production", () => {
    assert.notEqual(unitStillThere, null);
  });
  check("the requirement falls back to ON_MASTER while still published there", () => {
    // It was pushed to Master earlier, so Master still holds it.
    assert.equal(req2After.status, "ON_MASTER");
  });

  // Regression guard. ShootDay.scheduleAssignment was briefly onDelete:Cascade,
  // which meant unscheduling a block silently destroyed its days along with
  // their planning notes. It must be SetNull: the day survives, unlinked.
  const survivor = await prisma.scheduleAssignment.findFirstOrThrow({
    where: { variationId: varA.id },
  });
  await prisma.shootDay.create({
    data: {
      projectId: project.id,
      unitProductionId: ep1.id,
      scheduleAssignmentId: survivor.id,
      date: d("2027-03-15"),
      planningNote: "ZZZ day-level note that must not be destroyed",
    },
  });
  const daysBefore = await prisma.shootDay.count({ where: { projectId: project.id } });
  await unassign(survivor.id);
  const daysAfter = await prisma.shootDay.count({ where: { projectId: project.id } });
  const orphaned = await prisma.shootDay.count({
    where: { projectId: project.id, scheduleAssignmentId: null },
  });
  check("unscheduling does not destroy shoot days", () => {
    assert.equal(daysAfter, daysBefore);
  });
  check("the shoot days are unlinked rather than deleted", () => {
    assert.equal(orphaned, 1);
  });

  // --- Master guards ------------------------------------------------------
  console.log("\nMaster guards");
  let deleteBlocked = false;
  try {
    await deleteVariation(master.id);
  } catch {
    deleteBlocked = true;
  }
  check("the Master Calendar cannot be deleted", () => {
    assert.equal(deleteBlocked, true);
  });
  let selfPushBlocked = false;
  try {
    await pushToMaster({ variationId: master.id });
  } catch {
    selfPushBlocked = true;
  }
  check("Master cannot be pushed to itself", () => {
    assert.equal(selfPushBlocked, true);
  });

  // --- teardown -----------------------------------------------------------
  await cleanup();
  const finalMaster = await prisma.scheduleAssignment.count({ where: { variationId: master.id } });
  check("teardown leaves Master exactly as it was found", () => {
    assert.equal(finalMaster, realMasterBefore);
  });

  console.log(`\n${process.exitCode ? "FAILED" : "All passed"} — ${passed} assertions\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
