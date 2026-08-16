import { redirect } from "next/navigation";
import { auth, isDevLoginEnabled } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { googleSignIn, devSignIn } from "./actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/display";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const devUsers = isDevLoginEnabled
    ? await prisma.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      })
    : [];
  const userCount = await prisma.user.count();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gradient-to-br from-brand/10 via-background to-accent/10 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-2xl font-black text-white shadow-lg shadow-brand/30">
            Z
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Zero Gravity Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production management for Zero Gravity Media
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {googleConfigured ? (
            <form action={googleSignIn}>
              <Button type="submit" className="w-full" size="lg">
                Sign in with Google
              </Button>
            </form>
          ) : (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              Google sign-in isn&apos;t configured yet. Set GOOGLE_CLIENT_ID and
              GOOGLE_CLIENT_SECRET.
            </p>
          )}

          {userCount === 0 && (
            <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-xs text-info">
              No users yet — the first person to sign in becomes an Admin automatically.
            </p>
          )}

          {isDevLoginEnabled && (
            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dev login (local only)
              </p>
              {devUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active users to sign in as yet. Sign in with Google first, or seed one.
                </p>
              ) : (
                <form action={devSignIn} className="flex gap-2">
                  <select
                    name="email"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    {devUsers.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.name ?? u.email} — {ROLE_LABEL[u.role]}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">
                    Go
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
