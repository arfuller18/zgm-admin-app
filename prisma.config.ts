import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI (generate, migrate deploy/dev) — NOT by the
    // running app, see src/lib/prisma.ts. In production this should be a
    // connection that supports session-level locking (e.g. Supabase's
    // "Session pooler" on :5432, not the transaction pooler on :6543) —
    // pooled transaction-mode connections don't support what migrations
    // need and can hang forever instead of failing with a clear error.
    url: env("DATABASE_URL"),
  },
});
