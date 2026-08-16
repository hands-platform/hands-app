CREATE TYPE "TaxPolicyLifecycleStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'LEGACY_REVIEW'
);

CREATE TYPE "TaxPolicyProvenance" AS ENUM (
  'OPERATOR',
  'SEED',
  'SMOKE_TEST',
  'MIGRATION',
  'LEGACY_UNKNOWN'
);

CREATE TYPE "TaxPolicyApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'ACTIVATED',
  'FAILED'
);

ALTER TABLE "TaxPolicyVersion"
  ADD COLUMN "lifecycleStatus" "TaxPolicyLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "provenance" "TaxPolicyProvenance" NOT NULL DEFAULT 'OPERATOR',
  ADD COLUMN "jurisdiction" TEXT NOT NULL DEFAULT 'VN',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "legalSourceTitle" TEXT,
  ADD COLUMN "legalSourceUrl" TEXT,
  ADD COLUMN "promulgatedDate" TIMESTAMP(3),
  ADD COLUMN "taxSubject" TEXT,
  ADD COLUMN "changeSummary" TEXT,
  ADD COLUMN "supersedesPolicyVersionId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "approvedByAdminId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "TaxPolicyVersion"
SET "lifecycleStatus" = CASE
  WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"TaxPolicyLifecycleStatus"
  WHEN "status" = 'ARCHIVED' THEN 'ARCHIVED'::"TaxPolicyLifecycleStatus"
  WHEN "status" = 'DRAFT' THEN 'DRAFT'::"TaxPolicyLifecycleStatus"
  ELSE 'LEGACY_REVIEW'::"TaxPolicyLifecycleStatus"
END;

UPDATE "TaxPolicyVersion"
SET "provenance" = CASE
  WHEN lower("name") LIKE '%smoke%' THEN 'SMOKE_TEST'::"TaxPolicyProvenance"
  WHEN lower("name") LIKE '%seed%' THEN 'SEED'::"TaxPolicyProvenance"
  ELSE 'LEGACY_UNKNOWN'::"TaxPolicyProvenance"
END;

CREATE TABLE "TaxPolicyApprovalRequest" (
  "id" TEXT NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "requestedByAdminId" TEXT NOT NULL,
  "operatorReason" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "TaxPolicyApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedByAdminId" TEXT,
  "decisionReason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "activationJobId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "pendingKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxPolicyApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxPolicyApprovalRequest_idempotencyKey_key"
  ON "TaxPolicyApprovalRequest"("idempotencyKey");
CREATE UNIQUE INDEX "TaxPolicyApprovalRequest_pendingKey_key"
  ON "TaxPolicyApprovalRequest"("pendingKey");
CREATE INDEX "TaxPolicyApprovalRequest_status_requestedAt_idx"
  ON "TaxPolicyApprovalRequest"("status", "requestedAt");
CREATE INDEX "TaxPolicyApprovalRequest_policyVersionId_requestedAt_idx"
  ON "TaxPolicyApprovalRequest"("policyVersionId", "requestedAt");
CREATE INDEX "TaxPolicyApprovalRequest_requestedByAdminId_requestedAt_idx"
  ON "TaxPolicyApprovalRequest"("requestedByAdminId", "requestedAt");
CREATE INDEX "TaxPolicyApprovalRequest_decidedByAdminId_decidedAt_idx"
  ON "TaxPolicyApprovalRequest"("decidedByAdminId", "decidedAt");
CREATE INDEX "TaxPolicyApprovalRequest_scheduledFor_status_idx"
  ON "TaxPolicyApprovalRequest"("scheduledFor", "status");

CREATE INDEX "TaxPolicyVersion_lifecycleStatus_effectiveFrom_idx"
  ON "TaxPolicyVersion"("lifecycleStatus", "effectiveFrom");
CREATE INDEX "TaxPolicyVersion_provenance_createdAt_idx"
  ON "TaxPolicyVersion"("provenance", "createdAt");

CREATE UNIQUE INDEX "TaxPolicyVersion_one_active_status_idx"
  ON "TaxPolicyVersion"("status") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "TaxPolicyVersion_one_active_lifecycle_idx"
  ON "TaxPolicyVersion"("lifecycleStatus") WHERE "lifecycleStatus" = 'ACTIVE';

ALTER TABLE "TaxPolicyVersion"
  ADD CONSTRAINT "TaxPolicyVersion_supersedesPolicyVersionId_fkey"
  FOREIGN KEY ("supersedesPolicyVersionId") REFERENCES "TaxPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxPolicyVersion_approvedByAdminId_fkey"
  FOREIGN KEY ("approvedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxPolicyApprovalRequest"
  ADD CONSTRAINT "TaxPolicyApprovalRequest_policyVersionId_fkey"
  FOREIGN KEY ("policyVersionId") REFERENCES "TaxPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxPolicyApprovalRequest_requestedByAdminId_fkey"
  FOREIGN KEY ("requestedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxPolicyApprovalRequest_decidedByAdminId_fkey"
  FOREIGN KEY ("decidedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
