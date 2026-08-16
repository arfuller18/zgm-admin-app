"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { syncAirtable } from "@/lib/airtable-sync";

export async function runSync() {
  await requireRole("ADMIN");
  try {
    const summary = await syncAirtable();
    revalidatePath("/admin/sync");
    return { ok: true as const, summary };
  } catch (err) {
    revalidatePath("/admin/sync");
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}
