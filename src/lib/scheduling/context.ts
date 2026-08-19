// Bridges the pure work-calendar engine to the database. Kept separate from
// work-calendar.ts on purpose: that module stays free of DB access so its
// arithmetic can be tested directly (see scripts/verify-work-calendar.ts).

import { prisma } from "../prisma";
import {
  buildWorkCalendarContext,
  defaultWorkCalendarContext,
  type WorkCalendarContext,
} from "./work-calendar";

/**
 * Resolve the work calendar a variation schedules against, with its
 * exceptions. Falls back to the default calendar, then to a bare Mon–Fri
 * context, so scheduling maths never fails just because setup is incomplete.
 */
export async function loadWorkCalendarContext(
  variationId?: string | null
): Promise<WorkCalendarContext> {
  const calendar = variationId
    ? (
        await prisma.scheduleVariation.findUnique({
          where: { id: variationId },
          select: { workCalendar: true },
        })
      )?.workCalendar ?? (await prisma.workCalendar.findFirst({ where: { isDefault: true } }))
    : await prisma.workCalendar.findFirst({ where: { isDefault: true } });

  if (!calendar) return defaultWorkCalendarContext();

  const exceptions = await prisma.workCalendarException.findMany({
    where: { calendarId: calendar.id },
    select: { date: true, kind: true, projectId: true, reason: true },
  });

  return buildWorkCalendarContext(calendar, exceptions);
}
