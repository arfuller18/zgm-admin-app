"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

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

function dateVal(formData: FormData, name: string): Date | null {
  const v = str(formData, name);
  if (v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type UnitFormState = { status: "idle" } | { status: "error"; message: string };

export async function updateUnitProduction(
  projectId: string,
  unitId: string,
  _prevState: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  await requireUser();

  const name = str(formData, "name");
  if (!name) return { status: "error", message: "Unit production name is required." };

  await prisma.unitProduction.update({
    where: { id: unitId },
    data: {
      name,
      season: int(formData, "season"),
      episode: int(formData, "episode"),
      episodeTitle: str(formData, "episodeTitle"),
      scriptStatus: str(formData, "scriptStatus"),
      duration: int(formData, "duration"),
      startDate: dateVal(formData, "startDate"),
      endDate: dateVal(formData, "endDate"),
      bookedBy: str(formData, "bookedBy"),
      bookingWindow: str(formData, "bookingWindow"),
      notes: str(formData, "notes"),
      directorId: str(formData, "directorId"),
      writerId: str(formData, "writerId"),
    },
  });

  redirect(`/projects/${projectId}/units/${unitId}`);
}
