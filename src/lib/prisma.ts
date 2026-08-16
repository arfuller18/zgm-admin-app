import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The app's own queries use RUNTIME_DATABASE_URL (a pooled connection in
// production), falling back to DATABASE_URL locally where there's no
// pooler and both are the same database. The Prisma CLI (migrations,
// generate) always uses DATABASE_URL directly — see prisma.config.ts.
const adapter = new PrismaPg({
  connectionString: process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
