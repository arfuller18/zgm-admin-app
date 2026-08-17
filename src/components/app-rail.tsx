"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarRange, Wallet, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// The product-suite switcher: Zero Gravity's internal tools are three
// separate apps that happen to share this navigation shell. Admin and
// Scheduling live in this codebase (split by URL prefix); Budgeting is a
// genuinely separate deployment for now, linked out until it's integrated.
const INTERNAL_APPS = [
  {
    key: "admin",
    label: "Admin",
    href: "/",
    icon: Building2,
    active: (path: string) => !path.startsWith("/schedule"),
  },
  {
    key: "scheduling",
    label: "Scheduling",
    href: "/schedule",
    icon: CalendarRange,
    active: (path: string) => path.startsWith("/schedule"),
  },
] as const;

export function AppRail() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface-muted/60 py-4 sm:w-24">
      {INTERNAL_APPS.map((app) => {
        const isActive = app.active(pathname);
        const Icon = app.icon;
        return (
          <Link
            key={app.key}
            href={app.href}
            className={cn(
              "mx-2 flex flex-col items-center gap-1 rounded-xl px-1.5 py-3 text-center transition-colors",
              isActive
                ? "bg-brand text-brand-foreground shadow-sm shadow-brand/30"
                : "text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden text-[9px] font-medium uppercase tracking-wide opacity-70 sm:block">
              Zero Gravity
            </span>
            <span className="text-[11px] font-semibold leading-tight sm:text-xs">{app.label}</span>
          </Link>
        );
      })}

      <a
        href="https://zgm-budgeting-app.vercel.app"
        target="_blank"
        rel="noreferrer"
        className="mx-2 flex flex-col items-center gap-1 rounded-xl px-1.5 py-3 text-center text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <Wallet className="h-5 w-5" />
        <span className="hidden text-[9px] font-medium uppercase tracking-wide opacity-70 sm:block">
          Zero Gravity
        </span>
        <span className="flex items-center gap-0.5 text-[11px] font-semibold leading-tight sm:text-xs">
          Budgeting
          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
        </span>
      </a>
    </nav>
  );
}
