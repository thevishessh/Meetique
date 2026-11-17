-- PENDING requests (awaiting approval) hold their slot too: rebuild the double-booking constraint.
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_overlap";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "officer_id" WITH =,
    "seat_no" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'BOOKED', 'CHECKED_IN', 'WAITING', 'IN_PROGRESS'));
