-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('SCHEDULED', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "AttendeeResponse" AS ENUM ('ACKNOWLEDGED', 'ON_MY_WAY');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "attendee_response" "AttendeeResponse",
ADD COLUMN     "kind" "MeetingKind" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "requested_by_id" TEXT,
ADD COLUMN     "responded_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "officer_profiles" ADD COLUMN     "can_summon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "employee_id" TEXT,
ADD COLUMN     "job_title" TEXT;

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_employee_id_key" ON "users"("organization_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_user_id_key" ON "visitors"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

