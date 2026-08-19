"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Building2, CalendarRange, Wallet, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// The product-suite switcher: Zero Gravity's internal tools are three
// separate apps that happen to share this navigation shell. Admin and
// Scheduling live in this codebase (split by URL prefix); Budgeting is a
// genuinely separate deployment for now, linked out until it's integrated.
const INTERNAL_APPS = [
  {
    key: "admin",
    label: "Zero Gravity Admin",
    href: "/",
    icon: Building2,
    active: (path: string) => !path.startsWith("/schedule"),
  },
  {
    key: "scheduling",
    label: "Zero Gravity Scheduling",
    href: "/schedule",
    icon: CalendarRange,
    active: (path: string) => path.startsWith("/schedule"),
  },
] as const;

export function AppRail() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // The overlay has to portal straight to <body>: the header it'd otherwise
  // render inside uses backdrop-blur, and backdrop-filter (like transform
  // or filter) makes an element the containing block for its fixed-position
  // descendants — without this, "fixed inset-0" collapses to the header's
  // own box instead of the viewport. `document` doesn't exist during SSR,
  // so the portal target is only available once mounted on the client —
  // this is the standard pattern for that, not state synced from a prop.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const overlay = (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <span className="text-sm font-semibold text-muted-foreground">Switch app</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {INTERNAL_APPS.map((app) => {
            const isActive = app.active(pathname);
            const Icon = app.icon;
            return (
              <Link
                key={app.key}
                href={app.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                  isActive ? "bg-brand/10 text-brand-strong" : "text-foreground hover:bg-surface-muted"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-brand" : "text-muted-foreground")} />
                {app.label}
              </Link>
            );
          })}

          <a
            href="https://zgm-budget-app.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex items-center gap-2">
              Zero Gravity Budgeting
              <ExternalLink className="h-4 w-4 shrink-0 opacity-60" />
            </span>
          </a>
        </nav>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-muted"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}
