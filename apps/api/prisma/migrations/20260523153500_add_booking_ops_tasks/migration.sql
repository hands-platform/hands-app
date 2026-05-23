CREATE TYPE "BookingOpsTaskType" AS ENUM ('CUSTOMER_CONTACTED', 'PROVIDER_CONTACTED', 'LOCATION_CHECKED', 'PAYMENT_REVIEWED');

CREATE TYPE "BookingOpsTaskStatus" AS ENUM ('PENDING', 'DONE', 'BLOCKED');

CREATE TABLE "BookingOpsTask" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingOpsTaskType" NOT NULL,
    "status" "BookingOpsTaskStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingOpsTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingOpsTask_bookingId_type_key" ON "BookingOpsTask"("bookingId", "type");
CREATE INDEX "BookingOpsTask_bookingId_status_idx" ON "BookingOpsTask"("bookingId", "status");
CREATE INDEX "BookingOpsTask_actorId_updatedAt_idx" ON "BookingOpsTask"("actorId", "updatedAt");

ALTER TABLE "BookingOpsTask" ADD CONSTRAINT "BookingOpsTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingOpsTask" ADD CONSTRAINT "BookingOpsTask_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
