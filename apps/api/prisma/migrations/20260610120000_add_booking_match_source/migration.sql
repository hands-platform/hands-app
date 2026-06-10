-- Persist the final matching authority decision on the booking row.
CREATE TYPE "BookingMatchSource" AS ENUM ('FIRST_PICK_ACCEPTED_FIRST', 'CUSTOMER_SELECTED_PARTNER');

ALTER TABLE "Booking"
  ADD COLUMN "matchedAt" TIMESTAMP(3),
  ADD COLUMN "matchSource" "BookingMatchSource";

CREATE INDEX "Booking_matchSource_matchedAt_idx" ON "Booking"("matchSource", "matchedAt");
