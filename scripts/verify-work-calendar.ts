import assert from "node:assert/strict";
import {
  parseScheduleDate as d,
  formatScheduleDate as f,
  buildWorkCalendarContext,
  defaultWorkCalendarContext,
  isProductionDay,
  nonProductionReason,
  nextProductionDay,
  previousProductionDay,
  resolveEndDate,
  countProductionDays,
  listProductionDays,
  addProductionDays,
  shiftBlock,
} from "../src/lib/scheduling/work-calendar";

// Assertions for the production-day engine — the logic every drag, resize
// and bulk shift depends on. Run with:  npx tsx scripts/verify-work-calendar.ts
//
// Reference week (all UTC):
//   2027-01-11 Mon   2027-01-15 Fri   2027-01-16 Sat
//   2027-01-17 Sun   2027-01-18 Mon   2027-01-22 Fri

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

const MON_FRI = defaultWorkCalendarContext();

console.log("\nWeekday basics");
check("Monday is a production day", () => {
  assert.equal(isProductionDay(d("2027-01-11"), MON_FRI), true);
});
check("Saturday and Sunday are not", () => {
  assert.equal(isProductionDay(d("2027-01-16"), MON_FRI), false);
  assert.equal(isProductionDay(d("2027-01-17"), MON_FRI), false);
});
check("nextProductionDay snaps a Saturday forward to Monday", () => {
  assert.equal(f(nextProductionDay(d("2027-01-16"), MON_FRI)), "2027-01-18");
});
check("nextProductionDay leaves a weekday alone", () => {
  assert.equal(f(nextProductionDay(d("2027-01-13"), MON_FRI)), "2027-01-13");
});
check("previousProductionDay snaps a Sunday back to Friday", () => {
  assert.equal(f(previousProductionDay(d("2027-01-17"), MON_FRI)), "2027-01-15");
});

console.log("\nDuration — the brief's worked examples");
check("5 production days from Monday ends Friday", () => {
  assert.equal(f(resolveEndDate(d("2027-01-11"), 5, MON_FRI)), "2027-01-15");
});
check("5 production days from Friday ends the following Thursday", () => {
  // Fri 15, Mon 18, Tue 19, Wed 20, Thu 21 — the weekend is skipped, not consumed
  assert.equal(f(resolveEndDate(d("2027-01-15"), 5, MON_FRI)), "2027-01-21");
});
check("a 1-day block starts and ends the same day", () => {
  assert.equal(f(resolveEndDate(d("2027-01-11"), 1, MON_FRI)), "2027-01-11");
});
check("a block dropped on a Saturday snaps forward to Monday", () => {
  assert.equal(f(resolveEndDate(d("2027-01-16"), 5, MON_FRI)), "2027-01-22");
});
check("a 10-day block spans two working weeks", () => {
  assert.equal(f(resolveEndDate(d("2027-01-11"), 10, MON_FRI)), "2027-01-22");
});
check("duration below 1 is rejected", () => {
  assert.throws(() => resolveEndDate(d("2027-01-11"), 0, MON_FRI));
});

console.log("\nCounting");
check("Mon–Fri counts 5 production days", () => {
  assert.equal(countProductionDays(d("2027-01-11"), d("2027-01-15"), MON_FRI), 5);
});
check("Mon–Sun counts 5, not 7", () => {
  assert.equal(countProductionDays(d("2027-01-11"), d("2027-01-17"), MON_FRI), 5);
});
check("a weekend-only range counts 0", () => {
  assert.equal(countProductionDays(d("2027-01-16"), d("2027-01-17"), MON_FRI), 0);
});
check("listProductionDays returns the working dates only", () => {
  const days = listProductionDays(d("2027-01-15"), d("2027-01-18"), MON_FRI).map(f);
  assert.deepEqual(days, ["2027-01-15", "2027-01-18"]);
});

console.log("\nWeekend override");
const withSaturday = buildWorkCalendarContext(
  {
    worksSunday: false, worksMonday: true, worksTuesday: true, worksWednesday: true,
    worksThursday: true, worksFriday: true, worksSaturday: false,
  },
  [{ date: d("2027-01-16"), kind: "WORKDAY_OVERRIDE", projectId: null, reason: "EOTV Stunts" }]
);
check("an overridden Saturday becomes a production day", () => {
  assert.equal(isProductionDay(d("2027-01-16"), withSaturday), true);
});
check("the override makes a 5-day block finish a day earlier", () => {
  // Mon 11 → without override: Fri 15. With Sat 16 working it is unchanged,
  // but a block starting Wed 13 now ends Sat 16 rather than Tue 19.
  assert.equal(f(resolveEndDate(d("2027-01-13"), 4, MON_FRI)), "2027-01-18");
  assert.equal(f(resolveEndDate(d("2027-01-13"), 4, withSaturday)), "2027-01-16");
});
check("the following Saturday is still off — overrides are per-date", () => {
  assert.equal(isProductionDay(d("2027-01-23"), withSaturday), false);
});

console.log("\nHolidays and scoped overrides");
const withHoliday = buildWorkCalendarContext(
  {
    worksSunday: false, worksMonday: true, worksTuesday: true, worksWednesday: true,
    worksThursday: true, worksFriday: true, worksSaturday: false,
  },
  [
    { date: d("2027-01-13"), kind: "HOLIDAY", projectId: null, reason: "Company holiday" },
    { date: d("2027-01-13"), kind: "WORKDAY_OVERRIDE", projectId: "proj_eotv", reason: "EOTV shoots through" },
  ]
);
check("a company holiday removes a weekday", () => {
  assert.equal(isProductionDay(d("2027-01-13"), withHoliday), false);
});
check("a project-scoped override beats the company-wide holiday", () => {
  assert.equal(isProductionDay(d("2027-01-13"), withHoliday, "proj_eotv"), true);
});
check("a different project still observes the holiday", () => {
  assert.equal(isProductionDay(d("2027-01-13"), withHoliday, "proj_other"), false);
});
check("the holiday pushes an unscoped block out by a day", () => {
  assert.equal(f(resolveEndDate(d("2027-01-11"), 5, withHoliday)), "2027-01-18");
  assert.equal(f(resolveEndDate(d("2027-01-11"), 5, withHoliday, "proj_eotv")), "2027-01-15");
});
check("the reason is reportable for the UI", () => {
  assert.equal(nonProductionReason(d("2027-01-13"), withHoliday), "Company holiday");
  assert.equal(nonProductionReason(d("2027-01-16"), MON_FRI), "Non-production day");
  assert.equal(nonProductionReason(d("2027-01-11"), MON_FRI), null);
});

console.log("\nStepping");
check("+1 production day from Friday lands Monday (exclusive of start)", () => {
  assert.equal(f(addProductionDays(d("2027-01-15"), 1, MON_FRI)), "2027-01-18");
});
check("0 production days snaps to a valid day without moving otherwise", () => {
  assert.equal(f(addProductionDays(d("2027-01-11"), 0, MON_FRI)), "2027-01-11");
  assert.equal(f(addProductionDays(d("2027-01-16"), 0, MON_FRI)), "2027-01-18");
});
check("-1 production day from Monday lands the previous Friday", () => {
  assert.equal(f(addProductionDays(d("2027-01-18"), -1, MON_FRI)), "2027-01-15");
});
check("+5 production days from Friday lands the following Friday", () => {
  assert.equal(f(addProductionDays(d("2027-01-15"), 5, MON_FRI)), "2027-01-22");
});

console.log("\nShifting — durations must survive");
check("a +14 calendar-day shift preserves duration", () => {
  const r = shiftBlock(d("2027-01-11"), 5, 14, "CALENDAR_DAYS", MON_FRI);
  assert.equal(f(r.startDate), "2027-01-25");
  assert.equal(f(r.endDate), "2027-01-29");
  assert.equal(countProductionDays(r.startDate, r.endDate, MON_FRI), 5);
});
check("a shift landing on a weekend snaps forward, still 5 days", () => {
  // Mon 11 + 12 calendar days = Sat 23 → snaps to Mon 25
  const r = shiftBlock(d("2027-01-11"), 5, 12, "CALENDAR_DAYS", MON_FRI);
  assert.equal(f(r.startDate), "2027-01-25");
  assert.equal(countProductionDays(r.startDate, r.endDate, MON_FRI), 5);
});
check("a +5 production-day shift moves a week on", () => {
  const r = shiftBlock(d("2027-01-11"), 5, 5, "PRODUCTION_DAYS", MON_FRI);
  assert.equal(f(r.startDate), "2027-01-18");
  assert.equal(f(r.endDate), "2027-01-22");
});
check("a negative shift moves back and preserves duration", () => {
  const r = shiftBlock(d("2027-01-25"), 5, -14, "CALENDAR_DAYS", MON_FRI);
  assert.equal(f(r.startDate), "2027-01-11");
  assert.equal(f(r.endDate), "2027-01-15");
});
check("shifting a long block preserves its length exactly", () => {
  const r = shiftBlock(d("2027-01-11"), 50, 30, "CALENDAR_DAYS", MON_FRI);
  assert.equal(countProductionDays(r.startDate, r.endDate, MON_FRI), 50);
});

console.log("\nDate handling");
check("parse/format round-trips without timezone drift", () => {
  assert.equal(f(d("2027-01-11")), "2027-01-11");
  assert.equal(f(d("2026-12-31")), "2026-12-31");
});
check("a UTC-midnight date from Postgres reads as the right day", () => {
  // What Prisma hands back for a `@db.Date` column.
  assert.equal(f(new Date("2027-01-11T00:00:00.000Z")), "2027-01-11");
});
check("a calendar with no working days fails loudly rather than hanging", () => {
  const dead = buildWorkCalendarContext({
    worksSunday: false, worksMonday: false, worksTuesday: false, worksWednesday: false,
    worksThursday: false, worksFriday: false, worksSaturday: false,
  });
  assert.throws(() => nextProductionDay(d("2027-01-11"), dead), /no working weekdays/i);
});

console.log(
  `\n${process.exitCode ? "FAILED" : "All passed"} — ${passed} assertions\n`
);
