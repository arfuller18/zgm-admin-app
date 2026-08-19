// The single source of production-day arithmetic for the whole scheduling
// system. Every drag, resize, bulk shift and duration calculation goes
// through here — if this logic gets duplicated into a component, the two
// copies will disagree and schedules will silently drift.
//
// ---------------------------------------------------------------------------
// DATE CONVENTION
// ---------------------------------------------------------------------------
// Schedule dates are date-only values with no meaningful time component, and
// they are canonically represented as **UTC midnight** Date objects. That is
// exactly what Postgres `@db.Date` columns give back through Prisma, so
// values read from ScheduleAssignment.startDate need no conversion.
//
// This deliberately differs from src/lib/date-utils.ts, which builds the
// month grid in *local* time. Mixing the two is the classic off-by-one
// footgun: a UTC-midnight date read with local accessors renders as the
// previous day for anyone west of Greenwich. So: this module uses UTC
// accessors exclusively, and anything crossing the boundary goes through
// `parseScheduleDate` / `formatScheduleDate`.

import type {
  WorkCalendar,
  WorkCalendarException,
} from "../../../generated/prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A calendar with no production days at all would make the scanning loops
// below run forever. Every loop is capped; the cap is deliberately far
// larger than any real schedule so it only ever trips on a misconfiguration.
const MAX_SCAN_DAYS = 3650;

export type ShiftUnit = "CALENDAR_DAYS" | "PRODUCTION_DAYS";

/** A resolved work calendar, cheap to evaluate and free of DB access. */
export interface WorkCalendarContext {
  /** Indexed by JS day-of-week: 0 = Sunday … 6 = Saturday. */
  weekdayWorks: readonly boolean[];
  /** ISO date key → exceptions falling on that date. */
  exceptionsByDate: ReadonlyMap<string, readonly ResolvedException[]>;
}

export interface ResolvedException {
  kind: WorkCalendarException["kind"];
  /** null = applies company-wide; otherwise scoped to one project. */
  projectId: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Date primitives (UTC, date-only)
// ---------------------------------------------------------------------------

/** `"2027-01-11"` → UTC-midnight Date. */
export function parseScheduleDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC-midnight Date → `"2027-01-11"`. Also the map key format. */
export function formatScheduleDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Strip any time component, keeping the UTC calendar date. */
export function normalizeScheduleDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addCalendarDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/** Whole calendar days between two dates, inclusive of both ends. */
export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

// ---------------------------------------------------------------------------
// Context construction
// ---------------------------------------------------------------------------

export function buildWorkCalendarContext(
  calendar: Pick<
    WorkCalendar,
    | "worksSunday"
    | "worksMonday"
    | "worksTuesday"
    | "worksWednesday"
    | "worksThursday"
    | "worksFriday"
    | "worksSaturday"
  >,
  exceptions: Pick<WorkCalendarException, "date" | "kind" | "projectId" | "reason">[] = []
): WorkCalendarContext {
  const weekdayWorks = [
    calendar.worksSunday,
    calendar.worksMonday,
    calendar.worksTuesday,
    calendar.worksWednesday,
    calendar.worksThursday,
    calendar.worksFriday,
    calendar.worksSaturday,
  ] as const;

  const exceptionsByDate = new Map<string, ResolvedException[]>();
  for (const e of exceptions) {
    const key = formatScheduleDate(normalizeScheduleDate(e.date));
    const list = exceptionsByDate.get(key) ?? [];
    list.push({ kind: e.kind, projectId: e.projectId, reason: e.reason });
    exceptionsByDate.set(key, list);
  }

  return { weekdayWorks, exceptionsByDate };
}

/** ZGM's default: Monday–Friday. Useful for tests and for a missing calendar. */
export function defaultWorkCalendarContext(): WorkCalendarContext {
  return {
    weekdayWorks: [false, true, true, true, true, true, false],
    exceptionsByDate: new Map(),
  };
}

// ---------------------------------------------------------------------------
// The core question
// ---------------------------------------------------------------------------

/**
 * Is work possible on this date?
 *
 * Resolution order, most specific first:
 *   1. an exception scoped to this project
 *   2. a company-wide exception
 *   3. the calendar's weekday flags
 *
 * So a company-wide shutdown can be overridden for one production, which is
 * how "we're dark that week, except EOTV stunts" gets expressed.
 */
export function isProductionDay(
  date: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): boolean {
  const key = formatScheduleDate(date);
  const onDate = ctx.exceptionsByDate.get(key);

  if (onDate && onDate.length > 0) {
    const scoped = projectId ? onDate.find((e) => e.projectId === projectId) : undefined;
    const applicable = scoped ?? onDate.find((e) => e.projectId === null);
    if (applicable) {
      switch (applicable.kind) {
        case "WORKDAY_OVERRIDE":
          return true;
        case "NONWORKDAY_OVERRIDE":
        case "HOLIDAY":
        case "SHUTDOWN":
        case "BLACKOUT":
          return false;
      }
    }
  }

  return ctx.weekdayWorks[date.getUTCDay()] ?? false;
}

/** Why a given date is unavailable, for surfacing in the UI. */
export function nonProductionReason(
  date: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): string | null {
  if (isProductionDay(date, ctx, projectId)) return null;
  const onDate = ctx.exceptionsByDate.get(formatScheduleDate(date));
  const scoped = projectId ? onDate?.find((e) => e.projectId === projectId) : undefined;
  const applicable = scoped ?? onDate?.find((e) => e.projectId === null);
  return applicable ? applicable.reason : "Non-production day";
}

/** This date if it works, otherwise the next one that does. */
export function nextProductionDay(
  date: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): Date {
  let cursor = normalizeScheduleDate(date);
  for (let i = 0; i <= MAX_SCAN_DAYS; i++) {
    if (isProductionDay(cursor, ctx, projectId)) return cursor;
    cursor = addCalendarDays(cursor, 1);
  }
  throw new Error(
    "No production day found within 10 years — the work calendar has no working weekdays."
  );
}

/** This date if it works, otherwise the previous one that does. */
export function previousProductionDay(
  date: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): Date {
  let cursor = normalizeScheduleDate(date);
  for (let i = 0; i <= MAX_SCAN_DAYS; i++) {
    if (isProductionDay(cursor, ctx, projectId)) return cursor;
    cursor = addCalendarDays(cursor, -1);
  }
  throw new Error(
    "No production day found within 10 years — the work calendar has no working weekdays."
  );
}

/**
 * The end date of a block that starts on `start` and runs for
 * `durationDays` production days, **inclusive of the start day**.
 *
 * A 5-day block starting Monday ends Friday. Starting Friday, it ends the
 * following Thursday — the weekend is skipped, not consumed.
 *
 * If `start` is not itself a production day it snaps forward first, which is
 * what a scheduler expects when dropping an event onto a Saturday.
 */
export function resolveEndDate(
  start: Date,
  durationDays: number,
  ctx: WorkCalendarContext,
  projectId?: string | null
): Date {
  if (durationDays < 1) {
    throw new Error(`durationDays must be at least 1, got ${durationDays}`);
  }
  let cursor = nextProductionDay(start, ctx, projectId);
  for (let counted = 1; counted < durationDays; counted++) {
    cursor = nextProductionDay(addCalendarDays(cursor, 1), ctx, projectId);
  }
  return cursor;
}

/** Production days in a range, counting both ends. */
export function countProductionDays(
  start: Date,
  end: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): number {
  let cursor = normalizeScheduleDate(start);
  const last = normalizeScheduleDate(end);
  let count = 0;
  for (let i = 0; cursor <= last && i <= MAX_SCAN_DAYS; i++) {
    if (isProductionDay(cursor, ctx, projectId)) count++;
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

/** Every production date in a range — the basis for materialising shoot days. */
export function listProductionDays(
  start: Date,
  end: Date,
  ctx: WorkCalendarContext,
  projectId?: string | null
): Date[] {
  const days: Date[] = [];
  let cursor = normalizeScheduleDate(start);
  const last = normalizeScheduleDate(end);
  for (let i = 0; cursor <= last && i <= MAX_SCAN_DAYS; i++) {
    if (isProductionDay(cursor, ctx, projectId)) days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

/**
 * Move a block by `amount`, preserving its duration.
 *
 * Both units land the new start, snap it to a production day, then re-derive
 * the end from the duration — so a shifted block always spans the same number
 * of production days it did before, per the "Push X Days must preserve
 * durations" requirement.
 *
 *   CALENDAR_DAYS    +14 means fourteen days on the wall calendar
 *   PRODUCTION_DAYS  +5 from a Friday means the following Friday
 */
export function shiftBlock(
  start: Date,
  durationDays: number,
  amount: number,
  unit: ShiftUnit,
  ctx: WorkCalendarContext,
  projectId?: string | null
): { startDate: Date; endDate: Date } {
  const from = normalizeScheduleDate(start);

  let movedStart: Date;
  if (unit === "CALENDAR_DAYS") {
    movedStart = addCalendarDays(from, amount);
  } else {
    movedStart = addProductionDays(from, amount, ctx, projectId);
  }

  const startDate =
    amount < 0
      ? previousProductionDay(movedStart, ctx, projectId)
      : nextProductionDay(movedStart, ctx, projectId);

  return { startDate, endDate: resolveEndDate(startDate, durationDays, ctx, projectId) };
}

/**
 * Step `count` production days from a date. Zero returns the date snapped to
 * a production day; negatives step backwards. Unlike `resolveEndDate` this is
 * exclusive of the starting day — moving "+1 production day" from Friday
 * lands on Monday.
 */
export function addProductionDays(
  date: Date,
  count: number,
  ctx: WorkCalendarContext,
  projectId?: string | null
): Date {
  const step = count < 0 ? -1 : 1;
  const snap = step < 0 ? previousProductionDay : nextProductionDay;

  let cursor = snap(date, ctx, projectId);
  for (let i = 0; i < Math.abs(count); i++) {
    cursor = snap(addCalendarDays(cursor, step), ctx, projectId);
  }
  return cursor;
}
