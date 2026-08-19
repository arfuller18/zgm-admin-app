"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { runSchedulingBackfill, type BackfillSummary } from "@/lib/scheduling/backfill";

export async function runBackfill(): Promise<
  { ok: true; summary: BackfillSummary } | { ok: false; error: string }
> {
  await requireRole("ADMIN");
  try {
    const summary = await runSchedulingBackfill();
    revalidatePath("/admin/scheduling");
    revalidatePath("/schedule");
    revalidatePath("/schedule/master");
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
