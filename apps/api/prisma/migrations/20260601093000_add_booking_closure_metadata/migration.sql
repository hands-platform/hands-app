ALTER TABLE "Booking"
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedByRole" "Role",
  ADD COLUMN "closedReason" TEXT,
  ADD COLUMN "closedNote" TEXT;

CREATE INDEX "Booking_status_closedAt_idx" ON "Booking"("status", "closedAt");
CREATE INDEX "Booking_closedByRole_closedAt_idx" ON "Booking"("closedByRole", "closedAt");
