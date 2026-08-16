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
- **NextAuth.js (Auth.js) v5** with Google OAuth, JWT sessions, role-based access
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

## Roles

Mirrors the PRD's draft role table (`prisma/schema.prisma`'s `Role` enum):
Admin, Executive, Producer/PM, Department Lead, Crew/Staff, Finance,
Vendor/External. New Google sign-ins are created **inactive** by default —
an Admin must activate them from **Admin → Users & Roles** (or
pre-provision by email before they ever sign in). The very first person
ever to sign in is automatically promoted to an active Admin, so an empty
system isn't locked out.

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
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For real sign-in | From the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — see below |
| `ENABLE_DEV_LOGIN` | Local only | `"true"` adds an email-picker login that bypasses Google OAuth. **Never set this in production** — it's blocked automatically when `NODE_ENV=production` regardless |
| `AIRTABLE_API_KEY` | For sync | A [Personal Access Token](https://airtable.com/create/tokens) with read access to the ZGM base |
| `AIRTABLE_BASE_ID` | No | Defaults to `app1C5WNULP6I61dM` |

**Google OAuth setup:** create an OAuth 2.0 Client ID (type: Web application)
in the Google Cloud Console, add `http://localhost:3000/api/auth/callback/google`
(and your production URL's equivalent) as an authorized redirect URI.

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

Visit `http://localhost:3000`. With `ENABLE_DEV_LOGIN="true"` and no Google
credentials configured, the login page shows an email picker seeded with
the bootstrap admin — no OAuth app needed to develop locally.

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
3. Set the environment variables from the table above in the Vercel project settings.
4. Add your Vercel deployment URL's `/api/auth/callback/google` as an
   authorized redirect URI in the Google Cloud Console.
5. Run `npx prisma migrate deploy` against the production database (via a
   build step or manually), then `npm run db:seed` once.
6. Leave `ENABLE_DEV_LOGIN` unset.

## Project structure

```
prisma/schema.prisma          Data model
prisma/seed.ts                One-time Airtable snapshot import
prisma/seed-data/*.json       The snapshot itself
src/lib/prisma.ts             Prisma client singleton (driver adapter)
src/lib/auth.ts               NextAuth config (Google + dev-login + role bootstrap)
src/lib/airtable-sync.ts      Ongoing Airtable → Postgres pull-sync
src/lib/conflicts.ts          Booking conflict-detection logic
src/lib/display.ts            Enum → label/color mappings shared across pages
src/components/ui/            Small hand-rolled design system (bright ZGM theme)
src/app/(app)/                Authenticated app shell + all feature pages
src/app/login/                Public sign-in page
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
