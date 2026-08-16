-- Explicit provenance keeps synthetic administrators out of production readiness.
CREATE TYPE "AdminUserProvenance" AS ENUM ('PRODUCTION', 'FIXTURE');
CREATE TYPE "FinanceApproverAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "adminUserProvenance" "AdminUserProvenance",
  ADD COLUMN "fixtureKind" TEXT,
  ADD COLUMN "fixtureRunId" TEXT,
  ADD COLUMN "fixtureExpiresAt" TIMESTAMP(3);

CREATE TABLE "FinanceApproverAccessRequest" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "requestedEnabled" BOOLEAN NOT NULL,
  "previousEnabled" BOOLEAN NOT NULL,
  "previousRoles" "Role"[],
  "requestedByAdminId" TEXT NOT NULL,
  "operatorReason" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedTargetUpdatedAt" TIMESTAMP(3) NOT NULL,
  "status" "FinanceApproverAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedByAdminId" TEXT,
  "decisionReason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "pendingKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceApproverAccessRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceApproverAccessRequest_operatorReason_length_check"
    CHECK (char_length(btrim(regexp_replace("operatorReason", '\s+', ' ', 'g'))) BETWEEN 12 AND 500),
  CONSTRAINT "FinanceApproverAccessRequest_direction_check"
    CHECK ("requestedEnabled" <> "previousEnabled"),
  CONSTRAINT "FinanceApproverAccessRequest_state_check"
    CHECK (
      (
        "status" = 'PENDING'
        AND "pendingKey" IS NOT NULL
        AND "decidedByAdminId" IS NULL
        AND "decisionReason" IS NULL
        AND "decidedAt" IS NULL
        AND "executedAt" IS NULL
      )
      OR (
        "status" = 'APPROVED'
        AND "pendingKey" IS NULL
        AND "decidedByAdminId" IS NOT NULL
        AND char_length(btrim(regexp_replace("decisionReason", '\s+', ' ', 'g'))) BETWEEN 12 AND 500
        AND "decidedAt" IS NOT NULL
        AND "executedAt" IS NOT NULL
      )
      OR (
        "status" = 'REJECTED'
        AND "pendingKey" IS NULL
        AND "decidedByAdminId" IS NOT NULL
        AND char_length(btrim(regexp_replace("decisionReason", '\s+', ' ', 'g'))) BETWEEN 12 AND 500
        AND "decidedAt" IS NOT NULL
        AND "executedAt" IS NULL
      )
    )
);

CREATE UNIQUE INDEX "FinanceApproverAccessRequest_idempotencyKey_key"
  ON "FinanceApproverAccessRequest"("idempotencyKey");
CREATE UNIQUE INDEX "FinanceApproverAccessRequest_pendingKey_key"
  ON "FinanceApproverAccessRequest"("pendingKey");
CREATE INDEX "FinanceApproverAccessRequest_status_requestedAt_idx"
  ON "FinanceApproverAccessRequest"("status", "requestedAt");
CREATE INDEX "FinanceApproverAccessRequest_targetUserId_requestedAt_idx"
  ON "FinanceApproverAccessRequest"("targetUserId", "requestedAt");
CREATE INDEX "FinanceApproverAccessRequest_requestedByAdminId_requestedAt_idx"
  ON "FinanceApproverAccessRequest"("requestedByAdminId", "requestedAt");
CREATE INDEX "FinanceApproverAccessRequest_decidedByAdminId_decidedAt_idx"
  ON "FinanceApproverAccessRequest"("decidedByAdminId", "decidedAt");

ALTER TABLE "FinanceApproverAccessRequest"
  ADD CONSTRAINT "FinanceApproverAccessRequest_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceApproverAccessRequest"
  ADD CONSTRAINT "FinanceApproverAccessRequest_requestedByAdminId_fkey"
  FOREIGN KEY ("requestedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceApproverAccessRequest"
  ADD CONSTRAINT "FinanceApproverAccessRequest_decidedByAdminId_fkey"
  FOREIGN KEY ("decidedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
