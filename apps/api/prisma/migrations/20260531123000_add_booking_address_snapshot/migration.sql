CREATE TABLE "BookingAddressSnapshot" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "selectedLocationId" TEXT,
    "address" JSONB NOT NULL,
    "addressText" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'booking_confirmation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAddressSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingAddressSnapshot_bookingId_key" ON "BookingAddressSnapshot"("bookingId");
CREATE INDEX "BookingAddressSnapshot_customerProfileId_createdAt_idx" ON "BookingAddressSnapshot"("customerProfileId", "createdAt");
CREATE INDEX "BookingAddressSnapshot_selectedLocationId_idx" ON "BookingAddressSnapshot"("selectedLocationId");

ALTER TABLE "BookingAddressSnapshot"
ADD CONSTRAINT "BookingAddressSnapshot_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingAddressSnapshot"
ADD CONSTRAINT "BookingAddressSnapshot_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingAddressSnapshot"
ADD CONSTRAINT "BookingAddressSnapshot_selectedLocationId_fkey"
FOREIGN KEY ("selectedLocationId") REFERENCES "CustomerSelectedLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "BookingAddressSnapshot" (
    "id",
    "bookingId",
    "customerProfileId",
    "address",
    "addressText",
    "latitude",
    "longitude",
    "source",
    "createdAt"
)
SELECT
    'bas_' || "Booking"."id",
    "Booking"."id",
    "Booking"."customerProfileId",
    "Booking"."address",
    COALESCE(
        "Booking"."address" ->> 'addressText',
        "Booking"."address" ->> 'text',
        "Booking"."address" ->> 'label',
        "Booking"."address" ->> 'address',
        "Booking"."address"::TEXT
    ),
    "Booking"."lat",
    "Booking"."lng",
    'legacy_booking_address',
    "Booking"."createdAt"
FROM "Booking"
ON CONFLICT ("bookingId") DO NOTHING;
