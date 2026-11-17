-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pa_officer_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pa_officer_id_fkey" FOREIGN KEY ("pa_officer_id") REFERENCES "officer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

