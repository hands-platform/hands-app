CREATE TYPE "CompanyBankAccountEvidenceKind" AS ENUM ('OWNERSHIP', 'STATEMENT');

CREATE TYPE "CompanyBankAccountEvidenceStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'REVOKED');

CREATE TABLE "CompanyBankAccountEvidence" (
  "id" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "kind" "CompanyBankAccountEvidenceKind" NOT NULL,
  "status" "CompanyBankAccountEvidenceStatus" NOT NULL DEFAULT 'SUBMITTED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "contentSha256" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "submittedByAdminId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "revokedByAdminId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyBankAccountEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyBankAccountEvidence_fileAssetId_key"
ON "CompanyBankAccountEvidence"("fileAssetId");

CREATE UNIQUE INDEX "CompanyBankAccountEvidence_evidenceHash_key"
ON "CompanyBankAccountEvidence"("evidenceHash");

CREATE UNIQUE INDEX "CompanyBankAccountEvidence_bankAccountId_kind_version_key"
ON "CompanyBankAccountEvidence"("bankAccountId", "kind", "version");

CREATE INDEX "CompanyBankAccountEvidence_bankAccountId_kind_status_createdAt_idx"
ON "CompanyBankAccountEvidence"("bankAccountId", "kind", "status", "createdAt");

CREATE INDEX "CompanyBankAccountEvidence_submittedByAdminId_submittedAt_idx"
ON "CompanyBankAccountEvidence"("submittedByAdminId", "submittedAt");

CREATE INDEX "CompanyBankAccountEvidence_reviewedByAdminId_reviewedAt_idx"
ON "CompanyBankAccountEvidence"("reviewedByAdminId", "reviewedAt");

CREATE INDEX "CompanyBankAccountEvidence_revokedByAdminId_revokedAt_idx"
ON "CompanyBankAccountEvidence"("revokedByAdminId", "revokedAt");

ALTER TABLE "CompanyBankAccountEvidence"
ADD CONSTRAINT "CompanyBankAccountEvidence_bankAccountId_fkey"
FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyBankAccountEvidence"
ADD CONSTRAINT "CompanyBankAccountEvidence_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyBankAccountEvidence"
ADD CONSTRAINT "CompanyBankAccountEvidence_submittedByAdminId_fkey"
FOREIGN KEY ("submittedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyBankAccountEvidence"
ADD CONSTRAINT "CompanyBankAccountEvidence_reviewedByAdminId_fkey"
FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyBankAccountEvidence"
ADD CONSTRAINT "CompanyBankAccountEvidence_revokedByAdminId_fkey"
FOREIGN KEY ("revokedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
