CREATE TYPE "PaymentAdminOperationStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'REVIEW_REQUIRED');

CREATE TABLE "PaymentAdminOperationClaim" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "PaymentAdminOperationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "receipt" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAdminOperationClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAdminOperationClaim_paymentId_idempotencyKey_key"
ON "PaymentAdminOperationClaim"("paymentId", "idempotencyKey");

CREATE UNIQUE INDEX "PaymentAdminOperationClaim_paymentId_active_key"
ON "PaymentAdminOperationClaim"("paymentId")
WHERE "status" IN ('IN_PROGRESS', 'REVIEW_REQUIRED');

CREATE INDEX "PaymentAdminOperationClaim_paymentId_status_createdAt_idx"
ON "PaymentAdminOperationClaim"("paymentId", "status", "createdAt");

CREATE INDEX "PaymentAdminOperationClaim_status_updatedAt_idx"
ON "PaymentAdminOperationClaim"("status", "updatedAt");

ALTER TABLE "PaymentAdminOperationClaim"
ADD CONSTRAINT "PaymentAdminOperationClaim_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
