-- CreateEnum
CREATE TYPE "ShootDayStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'SHOT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkCalendarExceptionKind" AS ENUM ('HOLIDAY', 'SHUTDOWN', 'BLACKOUT', 'WORKDAY_OVERRIDE', 'NONWORKDAY_OVERRIDE');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('UNIT_PRODUCTION', 'PRODUCTION_EVENT');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'SCHEDULED_IN_VARIATION', 'ON_MASTER', 'COMPLETE');

-- CreateEnum
CREATE TYPE "VariationKind" AS ENUM ('MASTER', 'VARIATION');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationScope" AS ENUM ('ENTIRE_VARIATION', 'SELECTED_PROJECTS');

-- AlterTable
ALTER TABLE "ShootDay" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "scheduleAssignmentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ShootDayStatus" NOT NULL DEFAULT 'PLANNED';

-- CreateTable
CREATE TABLE "WorkCalendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "worksMonday" BOOLEAN NOT NULL DEFAULT true,
    "worksTuesday" BOOLEAN NOT NULL DEFAULT true,
    "worksWednesday" BOOLEAN NOT NULL DEFAULT true,
    "worksThursday" BOOLEAN NOT NULL DEFAULT true,
    "worksFriday" BOOLEAN NOT NULL DEFAULT true,
    "worksSaturday" BOOLEAN NOT NULL DEFAULT false,
    "worksSunday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCalendarException" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "WorkCalendarExceptionKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionEventType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultDurationDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionEventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "unitProductionId" TEXT,
    "eventTypeId" TEXT,
    "label" TEXT,
    "durationDays" INTEGER NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleVariation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "VariationKind" NOT NULL DEFAULT 'VARIATION',
    "status" "VariationStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceVariationId" TEXT,
    "workCalendarId" TEXT,
    "windowStart" DATE,
    "windowEnd" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "locationId" TEXT,
    "notes" TEXT,
    "legacyPhaseId" TEXT,
    "airtableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterPublication" (
    "id" TEXT NOT NULL,
    "sourceVariationId" TEXT,
    "scope" "PublicationScope" NOT NULL,
    "projectIds" TEXT[],
    "replacedSnapshot" JSONB,
    "appliedSnapshot" JSONB,
    "assignmentsAdded" INTEGER NOT NULL DEFAULT 0,
    "assignmentsReplaced" INTEGER NOT NULL DEFAULT 0,
    "assignmentsRemoved" INTEGER NOT NULL DEFAULT 0,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "MasterPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkCalendarException_calendarId_date_idx" ON "WorkCalendarException"("calendarId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCalendarException_calendarId_date_projectId_key" ON "WorkCalendarException"("calendarId", "date", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEventType_name_key" ON "ProductionEventType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionEventType_slug_key" ON "ProductionEventType"("slug");

-- CreateIndex
CREATE INDEX "SchedulingRequirement_projectId_status_idx" ON "SchedulingRequirement"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingRequirement_projectId_unitProductionId_key" ON "SchedulingRequirement"("projectId", "unitProductionId");

-- CreateIndex
CREATE INDEX "ScheduleVariation_kind_status_idx" ON "ScheduleVariation"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_legacyPhaseId_key" ON "ScheduleAssignment"("legacyPhaseId");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_variationId_startDate_endDate_idx" ON "ScheduleAssignment"("variationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_projectId_startDate_idx" ON "ScheduleAssignment"("projectId", "startDate");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_requirementId_idx" ON "ScheduleAssignment"("requirementId");

-- CreateIndex
CREATE INDEX "MasterPublication_publishedAt_idx" ON "MasterPublication"("publishedAt");

-- CreateIndex
CREATE INDEX "ShootDay_unitProductionId_idx" ON "ShootDay"("unitProductionId");

-- CreateIndex
CREATE INDEX "ShootDay_scheduleAssignmentId_idx" ON "ShootDay"("scheduleAssignmentId");

-- CreateIndex
CREATE INDEX "ShootDay_date_projectId_idx" ON "ShootDay"("date", "projectId");

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "ScheduleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCalendarException" ADD CONSTRAINT "WorkCalendarException_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCalendarException" ADD CONSTRAINT "WorkCalendarException_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingRequirement" ADD CONSTRAINT "SchedulingRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingRequirement" ADD CONSTRAINT "SchedulingRequirement_unitProductionId_fkey" FOREIGN KEY ("unitProductionId") REFERENCES "UnitProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingRequirement" ADD CONSTRAINT "SchedulingRequirement_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "ProductionEventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVariation" ADD CONSTRAINT "ScheduleVariation_sourceVariationId_fkey" FOREIGN KEY ("sourceVariationId") REFERENCES "ScheduleVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVariation" ADD CONSTRAINT "ScheduleVariation_workCalendarId_fkey" FOREIGN KEY ("workCalendarId") REFERENCES "WorkCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVariation" ADD CONSTRAINT "ScheduleVariation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ScheduleVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "SchedulingRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPublication" ADD CONSTRAINT "MasterPublication_sourceVariationId_fkey" FOREIGN KEY ("sourceVariationId") REFERENCES "ScheduleVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPublication" ADD CONSTRAINT "MasterPublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints Prisma's schema language cannot express.
-- ---------------------------------------------------------------------------

-- The Master Calendar is a singleton. A partial unique index makes a second
-- MASTER row impossible at the database level, not merely discouraged in the
-- service layer.
CREATE UNIQUE INDEX "one_master_variation"
  ON "ScheduleVariation" ("kind")
  WHERE "kind" = 'MASTER';

-- A requirement points at exactly one thing, matching its kind: a unit
-- production, or an event type. Never both, never neither.
ALTER TABLE "SchedulingRequirement"
  ADD CONSTRAINT "requirement_target_matches_kind" CHECK (
    ("kind" = 'UNIT_PRODUCTION'  AND "unitProductionId" IS NOT NULL AND "eventTypeId" IS NULL)
    OR
    ("kind" = 'PRODUCTION_EVENT' AND "eventTypeId"      IS NOT NULL AND "unitProductionId" IS NULL)
  );

-- A placement cannot end before it starts.
ALTER TABLE "ScheduleAssignment"
  ADD CONSTRAINT "assignment_end_after_start" CHECK ("endDate" >= "startDate");

-- Durations are positive.
ALTER TABLE "SchedulingRequirement"
  ADD CONSTRAINT "requirement_duration_positive" CHECK ("durationDays" > 0);
ALTER TABLE "ScheduleAssignment"
  ADD CONSTRAINT "assignment_duration_positive" CHECK ("durationDays" > 0);
