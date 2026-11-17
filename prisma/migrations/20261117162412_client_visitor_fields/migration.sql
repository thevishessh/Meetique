-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reference_no" TEXT,
ADD COLUMN     "visitor_category" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "reference_label" TEXT,
ADD COLUMN     "visitor_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
