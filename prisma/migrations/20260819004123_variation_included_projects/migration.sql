-- AlterTable
ALTER TABLE "ScheduleVariation" ADD COLUMN     "includedProjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: existing variations (Master included) get includedProjectIds
-- from whichever projects already have placements there, so the filter
-- bubbles aren't suddenly empty for schedules that already exist. Blank or
-- newly-created variations correctly stay [] until the creation picker or
-- "Manage projects" sets them explicitly.
UPDATE "ScheduleVariation" v
SET "includedProjectIds" = sub.project_ids
FROM (
  SELECT "variationId", array_agg(DISTINCT "projectId") AS project_ids
  FROM "ScheduleAssignment"
  GROUP BY "variationId"
) sub
WHERE v.id = sub."variationId";
