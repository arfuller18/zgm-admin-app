"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Role } from "../../../../../generated/prisma/enums";

const ROLES: Role[] = [
  "ADMIN",
  "EXECUTIVE",
  "PRODUCER_PM",
  "DEPARTMENT_LEAD",
  "CREW_STAFF",
  "FINANCE",
  "VENDOR_EXTERNAL",
];

export async function inviteUser(formData: FormData) {
  await requireRole("ADMIN");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "CREW_STAFF") as Role;
  if (!email || !ROLES.includes(role)) return;

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, active: true },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, role: string) {
  await requireRole("ADMIN");
  if (!ROLES.includes(role as Role)) return;
  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(userId: string, active: boolean) {
  const admin = await requireRole("ADMIN");
  if (admin.id === userId && !active) return; // can't lock yourself out
  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}
