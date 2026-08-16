// Core conflict-detection logic (PRD §4.2): is this person / location /
// equipment already booked on a *different* project during an overlapping
// date range? This is the flagship workflow of the whole app.

import { prisma } from "./prisma";
import type { BookingResourceType } from "../../generated/prisma/enums";

export interface ConflictingBooking {
  id: string;
  projectId: string;
  projectName: string;
  startDate: Date;
  endDate: Date;
  roleOnProject: string | null;
  status: string;
}

export async function findConflicts(params: {
  resourceType: BookingResourceType;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  excludeBookingId?: string;
  excludeProjectId?: string;
}): Promise<ConflictingBooking[]> {
  const { resourceType, resourceId, startDate, endDate, excludeBookingId } = params;

  const resourceFilter =
    resourceType === "PERSON"
      ? { personId: resourceId }
      : resourceType === "LOCATION"
        ? { locationId: resourceId }
        : { equipmentId: resourceId };

  const overlapping = await prisma.booking.findMany({
    where: {
      ...resourceFilter,
      status: { not: "CANCELLED" },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    include: { project: true },
    orderBy: { startDate: "asc" },
  });

  return overlapping.map((b) => ({
    id: b.id,
    projectId: b.projectId,
    projectName: b.project.name,
    startDate: b.startDate,
    endDate: b.endDate,
    roleOnProject: b.roleOnProject,
    status: b.status,
  }));
}

export interface GlobalConflictPair {
  resourceType: BookingResourceType;
  resourceName: string;
  bookingA: ConflictingBooking;
  bookingB: ConflictingBooking;
}

// Every currently-overlapping pair of bookings for the same resource across
// different projects — the "catch problems without checking every project"
// view for the executive dashboard (PRD §5.7).
export async function getGlobalConflicts(): Promise<GlobalConflictPair[]> {
  const bookings = await prisma.booking.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { project: true, person: true, location: true, equipment: true },
    orderBy: { startDate: "asc" },
  });

  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const resourceId = b.personId ?? b.locationId ?? b.equipmentId;
    if (!resourceId) continue;
    const key = `${b.resourceType}:${resourceId}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }

  const pairs: GlobalConflictPair[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.projectId === b.projectId) continue;
        if (a.startDate <= b.endDate && a.endDate >= b.startDate) {
          const resourceName = a.person?.fullName ?? a.location?.name ?? a.equipment?.name ?? "Unknown";
          pairs.push({
            resourceType: a.resourceType,
            resourceName,
            bookingA: {
              id: a.id,
              projectId: a.projectId,
              projectName: a.project.name,
              startDate: a.startDate,
              endDate: a.endDate,
              roleOnProject: a.roleOnProject,
              status: a.status,
            },
            bookingB: {
              id: b.id,
              projectId: b.projectId,
              projectName: b.project.name,
              startDate: b.startDate,
              endDate: b.endDate,
              roleOnProject: b.roleOnProject,
              status: b.status,
            },
          });
        }
      }
    }
  }
  return pairs;
}
