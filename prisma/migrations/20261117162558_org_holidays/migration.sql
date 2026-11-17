-- CreateTable
CREATE TABLE "org_holidays" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_holidays_organization_id_date_key" ON "org_holidays"("organization_id", "date");

-- AddForeignKey
ALTER TABLE "org_holidays" ADD CONSTRAINT "org_holidays_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
