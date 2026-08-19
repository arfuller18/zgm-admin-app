"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABEL } from "@/lib/display";
import { AppRail } from "@/components/app-rail";
import { SchedulingNav } from "@/components/scheduling-nav";

const ADMIN_NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  // The operational schedule is company-wide information, so it is reachable
  // from Admin directly — nobody should have to enter a planning scenario to
  // see what ZGM is currently doing.
  { href: "/schedule/master", label: "Master Calendar" },
  { href: "/people", label: "People" },
  { href: "/locations", label: "Locations" },
];

export function NavBar({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: string };
}) {
  const pathname = usePathname();
  const isScheduling = pathname.startsWith("/schedule");
  const navLinks = isScheduling ? [] : ADMIN_NAV_LINKS;

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <AppRail />
          <Link href={isScheduling ? "/schedule" : "/"} className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-accent text-sm font-black text-white shadow-sm">
              Z
            </span>
            <span className="hidden text-lg sm:inline">
              Zero Gravity <span className="text-brand">{isScheduling ? "Scheduling" : "Admin"}</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {isScheduling ? (
              <SchedulingNav />
            ) : (
              navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))
            )}
            {!isScheduling && user.role === "ADMIN" && (
              <Link
                href="/admin/users"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                Users &amp; Roles
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{user.name ?? user.email}</div>
            <div className="text-xs leading-tight text-muted-foreground">
              {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand-strong">
            {initials}
          </div>
        </div>
      </div>
      {(isScheduling || navLinks.length > 0) && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden">
          {isScheduling ? (
            <SchedulingNav />
          ) : (
            navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))
          )}
        </nav>
      )}
    </header>
  );
}
