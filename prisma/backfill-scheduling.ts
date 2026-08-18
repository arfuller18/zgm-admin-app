import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runSchedulingBackfill } from "../src/lib/scheduling/backfill";

// CLI wrapper. The logic lives in src/lib/scheduling/backfill.ts so the same
// code backs Admin → Scheduling Setup, which is how it gets run against
// production without a terminal.
//
//   npm run db:backfill-scheduling

runSchedulingBackfill()
  .then(async (summary) => {
    console.log("Backfill complete:", summary);
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("Backfill failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
