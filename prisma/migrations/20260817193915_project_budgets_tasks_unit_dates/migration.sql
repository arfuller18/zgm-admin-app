-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "additionalLinks" TEXT,
ADD COLUMN     "castingDirector" TEXT,
ADD COLUMN     "castingStatus" TEXT,
ADD COLUMN     "decksBiblesUrl" TEXT,
ADD COLUMN     "episodeLength" INTEGER,
ADD COLUMN     "googleFolderUrl" TEXT;

-- AlterTable
ALTER TABLE "UnitProduction" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalBudget" DECIMAL(14,2),
    "budgetPerEpisode" DECIMAL(14,2),
    "status" "BudgetStatus",
    "budgetSheetsLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT,
    "projectId" TEXT,
    "unitProductionId" TEXT,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "TaskPriority",
    "category" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_airtableId_key" ON "Budget"("airtableId");

-- CreateIndex
CREATE INDEX "Budget_projectId_idx" ON "Budget"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_airtableId_key" ON "Task"("airtableId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_unitProductionId_idx" ON "Task"("unitProductionId");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_unitProductionId_fkey" FOREIGN KEY ("unitProductionId") REFERENCES "UnitProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
