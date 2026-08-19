"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The Scheduling product's own sub-nav, distinct from the Admin top bar
// (which goes empty inside /schedule — this is what replaces it there).
// A flat set of four destinations rather than a deep menu: Dashboard is the
// overview, Master and Compare are single pages, and Variations covers both
// the picker grid and any individual workspace under it, so a scenario
// someone is actively editing still shows "Variations" as the active tab.
const LINKS: { href: string; label: string; match: (pathname: string) => boolean }[] = [
  { href: "/schedule", label: "Dashboard", match: (p) => p === "/schedule" },
  { href: "/schedule/master", label: "Master", match: (p) => p.startsWith("/schedule/master") },
  {
    href: "/schedule/variations",
    label: "Variations",
    match: (p) => p.startsWith("/schedule/variations") || p.startsWith("/schedule/v/"),
  },
  { href: "/schedule/compare", label: "Compare", match: (p) => p.startsWith("/schedule/compare") },
];

export function SchedulingNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex w-fit gap-1 rounded-xl border border-border bg-surface p-1">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-brand-foreground shadow-sm shadow-brand/20"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
