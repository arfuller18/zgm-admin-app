import "dotenv/config";
import { syncAirtable } from "../src/lib/airtable-sync";
import { prisma } from "../src/lib/prisma";

syncAirtable()
  .then(async (summary) => {
    console.log("Airtable sync complete:", summary);
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("Airtable sync failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
