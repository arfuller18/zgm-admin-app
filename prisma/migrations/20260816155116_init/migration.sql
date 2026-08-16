-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXECUTIVE', 'PRODUCER_PM', 'DEPARTMENT_LEAD', 'CREW_STAFF', 'FINANCE', 'VENDOR_EXTERNAL');

-- CreateEnum
CREATE TYPE "ProjectFormat" AS ENUM ('SERIES', 'FEATURE', 'LIMITED_SERIES', 'UNSCRIPTED', 'DOCUMENTARY', 'CO_PRO', 'SHORT_DIGITAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IDEA', 'SUBMISSION', 'OPTIONED', 'SCRIPT', 'PACKAGING', 'FINANCING', 'GREENLIGHT_READY', 'PREP', 'PAUSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'WATCH');

-- CreateEnum
CREATE TYPE "ProjectColor" AS ENUM ('PINK', 'PURPLE', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "ProjectContactRelation" AS ENUM ('EXECUTIVE_OWNER', 'DAY_TO_DAY_OWNER', 'SHOWRUNNER', 'KEY_TALENT', 'KEY_CREW', 'IMPORTANT_CONTACT');

-- CreateEnum
CREATE TYPE "BookingResourceType" AS ENUM ('PERSON', 'LOCATION', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'SOFT_HOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CREW_STAFF',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "name" TEXT NOT NULL,
    "projectCode" TEXT,
    "format" "ProjectFormat",
    "seasonFilm" TEXT,
    "episodeCount" INTEGER,
    "currentStatus" "ProjectStatus",
    "priority" "Priority",
    "zgmOwner" TEXT,
    "rightsStatus" TEXT,
    "rightsExpiration" TIMESTAMP(3),
    "scriptStatus" TEXT,
    "salesDistributionStatus" TEXT,
    "salesDistributionNotes" TEXT,
    "genre" TEXT,
    "projectColor" "ProjectColor",
    "mainContactRole" TEXT,
    "logline" TEXT,
    "whyZgm" TEXT,
    "audienceHook" TEXT,
    "biggestRisk" TEXT,
    "additionalNotes" TEXT,
    "taxCreditNotes" TEXT,
    "nextDecision" TEXT,
    "nextAction" TEXT,
    "nextActionDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "relation" "ProjectContactRelation" NOT NULL,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitProduction" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "episodeTitle" TEXT,
    "scriptStatus" TEXT,
    "duration" INTEGER,
    "bookedBy" TEXT,
    "bookingWindow" TEXT,
    "notes" TEXT,
    "directorId" TEXT,
    "writerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSchedulePhase" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "scheduleCode" TEXT,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workDays" INTEGER,
    "calendarDays" INTEGER,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSchedulePhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShootDay" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "shootDayCode" TEXT,
    "date" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "unitProductionId" TEXT,
    "parentScheduleId" TEXT,
    "seasonShootDay" INTEGER,
    "episodeDay" INTEGER,
    "dayOfWeek" TEXT,
    "location" TEXT,
    "planningNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "locationType" TEXT[],
    "agreementStatus" TEXT,
    "nearestHospital" TEXT,
    "cellService" BOOLEAN,
    "wifiAvailable" BOOLEAN,
    "parkingNotes" TEXT,
    "accessNotes" TEXT,
    "availabilityNotes" TEXT,
    "locationFee" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "contactType" TEXT[],
    "profession" TEXT[],
    "isUnion" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "unitProductionId" TEXT,
    "resourceType" "BookingResourceType" NOT NULL,
    "personId" TEXT,
    "locationId" TEXT,
    "equipmentId" TEXT,
    "roleOnProject" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "conflictAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SchedulePhaseUnits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SchedulePhaseUnits_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UnitProductionLocations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UnitProductionLocations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Project_airtableId_key" ON "Project"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE INDEX "Project_currentStatus_idx" ON "Project"("currentStatus");

-- CreateIndex
CREATE INDEX "Project_priority_idx" ON "Project"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContact_projectId_personId_relation_key" ON "ProjectContact"("projectId", "personId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "UnitProduction_airtableId_key" ON "UnitProduction"("airtableId");

-- CreateIndex
CREATE INDEX "UnitProduction_projectId_idx" ON "UnitProduction"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSchedulePhase_airtableId_key" ON "ProductionSchedulePhase"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSchedulePhase_scheduleCode_key" ON "ProductionSchedulePhase"("scheduleCode");

-- CreateIndex
CREATE INDEX "ProductionSchedulePhase_projectId_idx" ON "ProductionSchedulePhase"("projectId");

-- CreateIndex
CREATE INDEX "ProductionSchedulePhase_startDate_endDate_idx" ON "ProductionSchedulePhase"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDay_airtableId_key" ON "ShootDay"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDay_shootDayCode_key" ON "ShootDay"("shootDayCode");

-- CreateIndex
CREATE INDEX "ShootDay_projectId_idx" ON "ShootDay"("projectId");

-- CreateIndex
CREATE INDEX "ShootDay_date_idx" ON "ShootDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Location_airtableId_key" ON "Location"("airtableId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_airtableId_key" ON "Person"("airtableId");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE INDEX "Booking_personId_startDate_endDate_idx" ON "Booking"("personId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_locationId_startDate_endDate_idx" ON "Booking"("locationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_equipmentId_startDate_endDate_idx" ON "Booking"("equipmentId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_projectId_idx" ON "Booking"("projectId");

-- CreateIndex
CREATE INDEX "_SchedulePhaseUnits_B_index" ON "_SchedulePhaseUnits"("B");

-- CreateIndex
CREATE INDEX "_UnitProductionLocations_B_index" ON "_UnitProductionLocations"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitProduction" ADD CONSTRAINT "UnitProduction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitProduction" ADD CONSTRAINT "UnitProduction_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitProduction" ADD CONSTRAINT "UnitProduction_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedulePhase" ADD CONSTRAINT "ProductionSchedulePhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_unitProductionId_fkey" FOREIGN KEY ("unitProductionId") REFERENCES "UnitProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_parentScheduleId_fkey" FOREIGN KEY ("parentScheduleId") REFERENCES "ProductionSchedulePhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitProductionId_fkey" FOREIGN KEY ("unitProductionId") REFERENCES "UnitProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SchedulePhaseUnits" ADD CONSTRAINT "_SchedulePhaseUnits_A_fkey" FOREIGN KEY ("A") REFERENCES "ProductionSchedulePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SchedulePhaseUnits" ADD CONSTRAINT "_SchedulePhaseUnits_B_fkey" FOREIGN KEY ("B") REFERENCES "UnitProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitProductionLocations" ADD CONSTRAINT "_UnitProductionLocations_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitProductionLocations" ADD CONSTRAINT "_UnitProductionLocations_B_fkey" FOREIGN KEY ("B") REFERENCES "UnitProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
