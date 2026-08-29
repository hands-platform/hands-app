CREATE TYPE "CouponRedemptionState" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED', 'REVERSED');

ALTER TABLE "Coupon"
  ADD COLUMN "maxRedemptions" INTEGER,
  ADD COLUMN "grossBudgetAmount" BIGINT,
  ADD COLUMN "perCustomerRedemptionLimit" INTEGER,
  ADD COLUMN "minimumOrderAmount" INTEGER,
  ADD COLUMN "maximumDiscountAmount" INTEGER,
  ADD COLUMN "currency" TEXT,
  ADD CONSTRAINT "Coupon_maxRedemptions_check"
    CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0),
  ADD CONSTRAINT "Coupon_grossBudgetAmount_check"
    CHECK ("grossBudgetAmount" IS NULL OR "grossBudgetAmount" > 0),
  ADD CONSTRAINT "Coupon_perCustomerRedemptionLimit_check"
    CHECK ("perCustomerRedemptionLimit" IS NULL OR "perCustomerRedemptionLimit" > 0),
  ADD CONSTRAINT "Coupon_customerLimit_not_above_total_check"
    CHECK (
      "perCustomerRedemptionLimit" IS NULL
      OR "maxRedemptions" IS NULL
      OR "perCustomerRedemptionLimit" <= "maxRedemptions"
    ),
  ADD CONSTRAINT "Coupon_minimumOrderAmount_check"
    CHECK ("minimumOrderAmount" IS NULL OR "minimumOrderAmount" >= 0),
  ADD CONSTRAINT "Coupon_maximumDiscountAmount_check"
    CHECK ("maximumDiscountAmount" IS NULL OR "maximumDiscountAmount" > 0),
  ADD CONSTRAINT "Coupon_currency_check"
    CHECK ("currency" IS NULL OR "currency" = 'VND');

CREATE TABLE "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "state" "CouponRedemptionState" NOT NULL DEFAULT 'RESERVED',
  "discountAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "reservedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMPTZ(3),
  "releasedAt" TIMESTAMPTZ(3),
  "reversedAt" TIMESTAMPTZ(3),
  "releaseReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_discountAmount_check" CHECK ("discountAmount" > 0),
  CONSTRAINT "CouponRedemption_currency_check" CHECK ("currency" = 'VND'),
  CONSTRAINT "CouponRedemption_state_timestamps_check" CHECK (
    (
      "state" = 'RESERVED'
      AND "consumedAt" IS NULL
      AND "releasedAt" IS NULL
      AND "reversedAt" IS NULL
      AND "releaseReason" IS NULL
    )
    OR (
      "state" = 'CONSUMED'
      AND "consumedAt" IS NOT NULL
      AND "consumedAt" >= "reservedAt"
      AND "releasedAt" IS NULL
      AND "reversedAt" IS NULL
      AND "releaseReason" IS NULL
    )
    OR (
      "state" = 'RELEASED'
      AND "consumedAt" IS NULL
      AND "releasedAt" IS NOT NULL
      AND "releasedAt" >= "reservedAt"
      AND "reversedAt" IS NULL
      AND "releaseReason" IS NOT NULL
      AND char_length(btrim("releaseReason")) BETWEEN 1 AND 500
    )
    OR (
      "state" = 'REVERSED'
      AND "consumedAt" IS NOT NULL
      AND "consumedAt" >= "reservedAt"
      AND "releasedAt" IS NULL
      AND "reversedAt" IS NOT NULL
      AND "reversedAt" >= "consumedAt"
      AND "releaseReason" IS NULL
    )
  )
);

CREATE TABLE "CouponRedemptionReversalEvent" (
  "id" TEXT NOT NULL,
  "couponRedemptionId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CouponRedemptionReversalEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemptionReversalEvent_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "CouponRedemptionReversalEvent_sourceKey_check"
    CHECK (char_length(btrim("sourceKey")) BETWEEN 1 AND 500),
  CONSTRAINT "CouponRedemptionReversalEvent_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX "CouponRedemption_bookingId_key"
ON "CouponRedemption"("bookingId");

CREATE INDEX "CouponRedemption_couponId_state_idx"
ON "CouponRedemption"("couponId", "state");

CREATE INDEX "CouponRedemption_couponId_customerProfileId_state_idx"
ON "CouponRedemption"("couponId", "customerProfileId", "state");

CREATE INDEX "CouponRedemption_customerProfileId_createdAt_idx"
ON "CouponRedemption"("customerProfileId", "createdAt");

CREATE UNIQUE INDEX "CouponRedemptionReversalEvent_sourceKey_key"
ON "CouponRedemptionReversalEvent"("sourceKey");

CREATE INDEX "CouponRedemptionReversalEvent_couponRedemptionId_occurredAt_idx"
ON "CouponRedemptionReversalEvent"("couponRedemptionId", "occurredAt");

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_customerProfileId_fkey"
  FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponRedemptionReversalEvent"
  ADD CONSTRAINT "CouponRedemptionReversalEvent_couponRedemptionId_fkey"
  FOREIGN KEY ("couponRedemptionId") REFERENCES "CouponRedemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "CouponRedemptionReversalEvent_reject_mutation"
BEFORE UPDATE OR DELETE ON "CouponRedemptionReversalEvent"
FOR EACH ROW
EXECUTE FUNCTION reject_accounting_journal_entry_mutation();
