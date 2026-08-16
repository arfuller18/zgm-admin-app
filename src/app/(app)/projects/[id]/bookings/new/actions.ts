"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { findConflicts, type ConflictingBooking } from "@/lib/conflicts";
import type { BookingResourceType } from "../../../../../../../generated/prisma/enums";

export interface BookingFormValues {
  unitProductionId: string;
  resourceType: BookingResourceType;
  resourceId: string;
  newResourceName: string;
  roleOnProject: string;
  startDate: string;
  endDate: string;
  notes: string;
  conflictAcknowledged: string;
}

export type BookingFormState =
  | { status: "idle" }
  | { status: "error"; message: string; values: BookingFormValues }
  | { status: "conflict"; conflicts: ConflictingBooking[]; values: BookingFormValues };

function readValues(formData: FormData): BookingFormValues {
  return {
    unitProductionId: String(formData.get("unitProductionId") ?? ""),
    resourceType: (String(formData.get("resourceType") ?? "PERSON") as BookingResourceType),
    resourceId: String(formData.get("resourceId") ?? ""),
    newResourceName: String(formData.get("newResourceName") ?? "").trim(),
    roleOnProject: String(formData.get("roleOnProject") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
    conflictAcknowledged: String(formData.get("conflictAcknowledged") ?? ""),
  };
}

export async function createBooking(
  projectId: string,
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const user = await requireUser();
  const values = readValues(formData);

  const startDate = values.startDate ? new Date(values.startDate) : null;
  const endDate = values.endDate ? new Date(values.endDate) : null;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { status: "error", message: "Start and end dates are required.", values };
  }
  if (endDate < startDate) {
    return { status: "error", message: "End date can't be before the start date.", values };
  }
  if (!values.resourceId && !values.newResourceName) {
    return { status: "error", message: "Pick an existing resource or name a new one.", values };
  }

  // Resolve (or create) the resource being booked.
  let resourceId = values.resourceId;
  if (!resourceId && values.newResourceName) {
    if (values.resourceType === "PERSON") {
      const person = await prisma.person.create({ data: { fullName: values.newResourceName } });
      resourceId = person.id;
    } else if (values.resourceType === "LOCATION") {
      const location = await prisma.location.create({ data: { name: values.newResourceName, locationType: [] } });
      resourceId = location.id;
    } else {
      const equipment = await prisma.equipment.create({ data: { name: values.newResourceName } });
      resourceId = equipment.id;
    }
  }

  const conflicts = await findConflicts({
    resourceType: values.resourceType,
    resourceId,
    startDate,
    endDate,
  });

  if (conflicts.length > 0 && values.conflictAcknowledged !== "true") {
    return { status: "conflict", conflicts, values: { ...values, resourceId } };
  }

  const booking = await prisma.booking.create({
    data: {
      projectId,
      unitProductionId: values.unitProductionId || null,
      resourceType: values.resourceType,
      personId: values.resourceType === "PERSON" ? resourceId : null,
      locationId: values.resourceType === "LOCATION" ? resourceId : null,
      equipmentId: values.resourceType === "EQUIPMENT" ? resourceId : null,
      roleOnProject: values.roleOnProject || null,
      startDate,
      endDate,
      status: "CONFIRMED",
      conflictAcknowledged: conflicts.length > 0,
      notes: values.notes || null,
      createdById: user.id,
    },
  });

  redirect(`/projects/${projectId}?tab=bookings&created=${booking.id}`);
}
