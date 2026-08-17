import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The app's own queries use RUNTIME_DATABASE_URL (a pooled connection in
// production), falling back to DATABASE_URL locally where there's no
// pooler and both are the same database. The Prisma CLI (migrations,
// generate) always uses DATABASE_URL directly — see prisma.config.ts.
//
// Supabase's pooler presents a certificate chain that Node's default trust
// store rejects as self-signed (P1011 "self-signed certificate in
// certificate chain"); the connection is still encrypted, we're just not
// validating the chain against a CA, same as `sslmode=require` (not
// `verify-full`) does for psql. Local Postgres has no SSL listener at all,
// so this only applies in production.
const adapter = new PrismaPg({
  connectionString: process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
