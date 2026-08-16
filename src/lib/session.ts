import { prisma } from "./prisma";
import { redirect } from "next/navigation";

// --- Sign-in is intentionally disabled for now ---
// Every request acts as a single default Admin user instead of requiring a
// login. This is deliberate: auth was adding setup friction (a Google OAuth
// app, credentials) before there was anything worth gating. The NextAuth
// config (auth.ts), the login page, and Google provider wiring are all left
// in place untouched — to turn real sign-in back on later, restore
// requireUser() below to its session-checking form (git history has it) and
// nothing else in the app needs to change, since every page already calls
// requireUser()/requireRole() rather than checking sessions directly.

const DEFAULT_USER_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "arfuller18@gmail.com";

export async function requireUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      image: existing.image,
      role: existing.role,
    };
  }

  // No users at all yet (e.g. a fresh DB that hasn't been seeded) — create
  // one so there's always a real row to attribute bookings/edits to.
  const created = await prisma.user.create({
    data: { email: DEFAULT_USER_EMAIL, name: "Allison Fuller", role: "ADMIN", active: true },
  });
  return {
    id: created.id,
    name: created.name,
    email: created.email,
    image: created.image,
    role: created.role,
  };
}

export async function requireRole(...roles: string[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
