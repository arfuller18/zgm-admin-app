# Zero Gravity Admin

Production management for Zero Gravity Media — projects, unit productions,
production schedules, shoot days, locations, people, and resource-booking
conflict detection, in one system of record.

This is the **first build**: core production management only, per the
[PRD](.)'s own phased roadmap. Budgets/approvals, executive exports/form
builder, Movie Magic-style stripboard scheduling, messaging, and the
separate streaming/AI media platform are deliberately out of scope here —
see [What's not in this build](#whats-not-in-this-build).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript
- **Tailwind CSS v4** with a hand-rolled component kit (`src/components/ui`) — no external UI library
- **Prisma 7** + **PostgreSQL** (via `@prisma/adapter-pg`) as the app's own database
- **NextAuth.js (Auth.js) v5** with Google OAuth — built, wired, and **currently disabled** (see [Sign-in](#sign-in-currently-disabled))
- **Airtable** (`airtable` npm SDK) — one-directional pull-sync from ZGM's existing base

## Architecture: own database, pull-synced from Airtable

ZGM's current Airtable base (`app1C5WNULP6I61dM`, the "Zero Gravity Media"
workspace) is the reference source for Projects, Unit Productions,
Production Schedule phases, Shoot Days, Locations, and the Contacts linked
into those. This app has **its own Postgres database** as the source of
truth going forward — Airtable's API isn't built for the relational
conflict-detection queries this app depends on, and dozens of concurrent
productions need real indexes, not API rate limits.

- **`prisma/seed.ts`** — one-time bootstrap from a snapshot of the live
  Airtable data (`prisma/seed-data/*.json`), pulled 2026-08-16. Run once
  against a fresh database.
- **`src/lib/airtable-sync.ts`** (`npm run sync:airtable`, or
  **Admin → Airtable Sync** in the app) — the ongoing sync. Pulls the
  latest Airtable state and upserts it into Postgres, keyed by
  `airtableId`. **Pull-only** — nothing is written back to Airtable, and
  the new entities this app introduces (**Booking**, **Equipment** — there
  is no Airtable equivalent for resource-level bookings) are never
  touched by the sync.
- The "General ZGM Info" / "Cori's Birthday"-style placeholder records in
  Project Hub are filtered out automatically (see
  `isPlaceholderProject` in `src/lib/airtable-mappings.ts`).

If/when ZGM sunsets Airtable for this workflow, nothing else needs to
change — just stop running the sync.

## The flagship feature: booking conflict detection

Per the PRD, this is "the single most important workflow in the system."
`Booking` is a first-class entity (person, location, or equipment × a
project × a date range). Creating one checks every other non-cancelled
booking for that same resource across **every other project**:

- No overlap → saves immediately.
- Overlap found → the form shows exactly what's conflicting (which
  project, which dates, who holds it) and requires an explicit
  "I understand, book anyway" acknowledgment before saving (soft-flag,
  not a hard block — see `src/lib/conflicts.ts`).
- The executive dashboard (`/`) surfaces **every currently-conflicting
  pair in the system** without anyone having to check project-by-project.
- A person's or location's detail page shows a red "Conflict" badge on
  any booking that overlaps another project's booking for them.

## Sign-in (currently disabled)

There is no login step right now — every visitor acts as a single default
Admin user (`src/lib/session.ts`'s `requireUser()`), so the app is usable
immediately with no Google Cloud setup. This was a deliberate call: get a
real OAuth app together once there's something worth gating, not before.

Nothing about this is a dead end. Every page already goes through
`requireUser()`/`requireRole()` rather than checking sessions directly, and
the whole NextAuth setup is still in the repo, untouched:

- `src/lib/auth.ts` — Google OAuth provider, JWT sessions, role bootstrap
  (first sign-in becomes an active Admin, everyone after starts inactive
  until approved from **Admin → Users & Roles**)
- `src/app/login/page.tsx` — the sign-in page (Google button + a local
  dev-login email picker gated by `ENABLE_DEV_LOGIN`)
- `src/app/api/auth/[...nextauth]/route.ts` — the NextAuth route handler

**To turn real sign-in back on:** restore `requireUser()` in
`src/lib/session.ts` to call `auth()` and redirect unauthenticated visitors
to `/login` (check `git log` for the prior version), add the "Sign out"
button back to `src/components/nav-bar.tsx` (`signOutAction` in
`src/app/(app)/actions.ts` is already there, just unused), and set
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`AUTH_SECRET`. Nothing else in
the app needs to change.

## Roles

Mirrors the PRD's draft role table (`prisma/schema.prisma`'s `Role` enum):
Admin, Executive, Producer/PM, Department Lead, Crew/Staff, Finance,
Vendor/External. Enforced by `requireRole()` on admin-only pages already —
it just has nothing to check against a real signed-in identity until
sign-in is turned back on.

## Local development

### 1. Database

You need a local Postgres instance (or point `DATABASE_URL` at a hosted one).

```bash
createdb zgm_admin   # or use an existing Postgres server
```

### 2. Environment variables

Copy `.env` and fill in as needed:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Standard `postgresql://` connection string |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Identity used for the default no-login user and the seed script. Defaults to `arfuller18@gmail.com` |
| `AIRTABLE_API_KEY` | For sync | A [Personal Access Token](https://airtable.com/create/tokens) with read access to the ZGM base |
| `AIRTABLE_BASE_ID` | No | Defaults to `app1C5WNULP6I61dM` |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENABLE_DEV_LOGIN` | Not used yet | Only matter once sign-in is turned back on — see [Sign-in](#sign-in-currently-disabled) |

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate    # applies prisma/migrations
npm run db:seed        # loads the Airtable snapshot + bootstraps an admin user
```

The seed bootstraps an Admin user from `BOOTSTRAP_ADMIN_EMAIL` (defaults to
`arfuller18@gmail.com`, matching the PRD's named owner). Override it if
someone else should be the first admin:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@zerogravitymedia.com npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000` — it opens straight to the dashboard, no
login step (see [Sign-in](#sign-in-currently-disabled)).

### 5. Keep data current

```bash
AIRTABLE_API_KEY=... npm run sync:airtable
```

Or, once signed in as an Admin, use **Admin → Airtable Sync** in the app.
For production, wire this up to a scheduled job (e.g. Vercel Cron hitting
an authenticated route, or a periodic GitHub Action) — it isn't scheduled
automatically yet.

## Deploying (Vercel)

1. Push this repo to GitHub, import it into Vercel.
2. Provision a Postgres database (Vercel Postgres, Neon, or Supabase all work — it's just `DATABASE_URL`).
3. Set `DATABASE_URL` (and `AIRTABLE_API_KEY`/`AIRTABLE_BASE_ID` if you want sync working) in the Vercel project settings.
4. Run `npx prisma migrate deploy` against the production database (via a
   build step or manually), then `npm run db:seed` once.
5. Deploy. There's no auth step to configure yet — see
   [Sign-in](#sign-in-currently-disabled) for when you're ready to add it.

`package.json`'s `postinstall` script (`prisma generate`) regenerates the
Prisma client automatically on every Vercel build — it's gitignored as
build output, so this has to happen fresh each deploy.

## Project structure

```
prisma/schema.prisma          Data model
prisma/seed.ts                One-time Airtable snapshot import
prisma/seed-data/*.json       The snapshot itself
src/lib/prisma.ts             Prisma client singleton (driver adapter)
src/lib/session.ts            requireUser()/requireRole() — currently a no-login stub
src/lib/auth.ts               NextAuth config, built but not yet wired in (see Sign-in)
src/lib/airtable-sync.ts      Ongoing Airtable → Postgres pull-sync
src/lib/conflicts.ts          Booking conflict-detection logic
src/lib/display.ts            Enum → label/color mappings shared across pages
src/components/ui/            Small hand-rolled design system (bright ZGM theme)
src/app/(app)/                App shell + all feature pages (force-dynamic: every page queries Postgres live on each request, never statically cached)
src/app/login/                Sign-in page, built but currently unlinked
```

## What's not in this build

Scoped out deliberately for this first pass (see the PRD's phased
roadmap) — not forgotten:

- **Budgets, cost estimation, approval workflow** (PRD §5.2, §5.4, §4.3)
- **Executive/resource dashboards beyond the home page, custom reporting, one-sheet/schedule/budget exports** (PRD §5.2, §5.3)
- **Form builder** for non-technical custom fields (PRD §5.5)
- **Threaded comments / @mentions** (PRD §5.6)
- **Movie Magic-style stripboard, breakdown sheets, DOOD reports, AI-suggested crew rates** (PRD §5.8) — a substantial build of its own; the PRD itself recommends a focused discovery pass before scoping it
- **Streaming / AI media platform** (PRD §6) — explicitly a non-goal for this phase per the PRD
- Two-way Airtable sync (writes from this app back into Airtable)
