-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OFFICER', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CHECKED_IN', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'WALK_IN');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('UNAVAILABLE', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT,
    "designation" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "slot_duration_min" INTEGER NOT NULL DEFAULT 15,
    "buffer_min" INTEGER NOT NULL DEFAULT 5,
    "capacity_per_slot" INTEGER NOT NULL DEFAULT 1,
    "max_per_day" INTEGER,
    "advance_booking_days" INTEGER NOT NULL DEFAULT 30,
    "min_notice_min" INTEGER NOT NULL DEFAULT 60,
    "allow_same_day" BOOLEAN NOT NULL DEFAULT true,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "officer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_start" TEXT,
    "break_end" TEXT,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "kind" "BlockKind" NOT NULL DEFAULT 'UNAVAILABLE',
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "seat_no" INTEGER NOT NULL DEFAULT 1,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "AppointmentSource" NOT NULL DEFAULT 'ONLINE',
    "purpose" TEXT,
    "notes" TEXT,
    "manage_code" TEXT NOT NULL,
    "checked_in_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "token_number" TEXT NOT NULL,
    "qr_secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_counters" (
    "organization_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "token_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "appointment_logs" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "old_status" "AppointmentStatus",
    "new_status" "AppointmentStatus" NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_role_idx" ON "users"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "officer_profiles_user_id_key" ON "officer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "officer_profiles_organization_id_idx" ON "officer_profiles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_officer_id_weekday_key" ON "working_hours"("officer_id", "weekday");

-- CreateIndex
CREATE INDEX "availability_blocks_officer_id_start_at_idx" ON "availability_blocks"("officer_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_organization_id_phone_key" ON "visitors"("organization_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_manage_code_key" ON "appointments"("manage_code");

-- CreateIndex
CREATE INDEX "appointments_officer_id_start_at_idx" ON "appointments"("officer_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_organization_id_start_at_idx" ON "appointments"("organization_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_number_key" ON "tokens"("token_number");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_qr_secret_key" ON "tokens"("qr_secret");

-- CreateIndex
CREATE INDEX "tokens_appointment_id_idx" ON "tokens"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_logs_appointment_id_idx" ON "appointment_logs"("appointment_id");

-- CreateIndex
CREATE INDEX "notifications_appointment_id_idx" ON "notifications"("appointment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_counters" ADD CONSTRAINT "token_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_logs" ADD CONSTRAINT "appointment_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_logs" ADD CONSTRAINT "appointment_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Double-booking protection (database level, not just UI)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Sanity checks
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order_chk" CHECK ("end_at" > "start_at");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_seat_chk" CHECK ("seat_no" >= 1);
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_time_order_chk" CHECK ("end_at" > "start_at");
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_capacity_chk" CHECK ("capacity_per_slot" BETWEEN 1 AND 100);
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_duration_chk" CHECK ("slot_duration_min" BETWEEN 5 AND 480);

-- The same seat of the same officer can never hold two overlapping ACTIVE appointments.
-- With capacity 1 this means: no overlapping bookings for an officer, ever.
-- Cancelled / no-show / completed appointments release the slot automatically.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "officer_id" WITH =,
    "seat_no" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("status" IN ('BOOKED', 'CHECKED_IN', 'WAITING', 'IN_PROGRESS'));

-- Each appointment can have only one active token.
CREATE UNIQUE INDEX "tokens_one_active_per_appointment" ON "tokens" ("appointment_id") WHERE "is_active";
