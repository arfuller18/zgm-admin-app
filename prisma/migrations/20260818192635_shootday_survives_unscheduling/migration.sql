-- DropForeignKey
ALTER TABLE "ShootDay" DROP CONSTRAINT "ShootDay_scheduleAssignmentId_fkey";

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "ScheduleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
