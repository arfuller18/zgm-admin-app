import { requireUser } from "@/lib/session";
import { NavBar } from "@/components/nav-bar";
import { AppRail } from "@/components/app-rail";

// Every page here reads live data straight from Postgres on each request.
// Without a session/cookie read forcing dynamic rendering (which auth()
// used to do for free), Next.js would otherwise statically prerender some
// of these at build time and serve stale data forever.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full">
      <AppRail />
      <div className="flex min-h-full flex-1 flex-col">
        <NavBar user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
