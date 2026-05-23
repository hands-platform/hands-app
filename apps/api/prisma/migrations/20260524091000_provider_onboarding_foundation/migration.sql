-- Provider onboarding foundation for KYC, bank accounts, tax policy, payout gating,
-- agreements, and provider device/session security.

CREATE TYPE "ProviderLevel" AS ENUM ('LEVEL_1_SIGNUP', 'LEVEL_2_ACTIVE', 'LEVEL_3_PAYOUT_ENABLED', 'LEVEL_4_TRUSTED');
CREATE TYPE "ProviderKycStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');
CREATE TYPE "ProviderDocumentType" AS ENUM ('CCCD_FRONT', 'CCCD_BACK', 'SELFIE', 'PROFILE_PHOTO', 'WORK_PHOTO', 'BANK_QR');
CREATE TYPE "ProviderDocumentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "ProviderBankAccountStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISABLED');
CREATE TYPE "ProviderTaxProfileStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "TaxPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "TaxRuleScope" AS ENUM ('DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND');
CREATE TYPE "ProviderAgreementType" AS ENUM ('TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX');

ALTER TABLE "ProviderProfile"
ADD COLUMN "activityNickname" TEXT,
ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "blockedReason" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "facebookId" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "legalName" TEXT,
ADD COLUMN "level" "ProviderLevel" NOT NULL DEFAULT 'LEVEL_1_SIGNUP',
ADD COLUMN "residentialAddress" TEXT,
ADD COLUMN "serviceArea" JSONB,
ADD COLUMN "trustedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ProviderKyc" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "cccdNumberHash" TEXT,
    "cccdNumberLast4" TEXT,
    "status" "ProviderKycStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderKyc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "type" "ProviderDocumentType" NOT NULL,
    "status" "ProviderDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderBankAccount" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberMasked" TEXT,
    "accountNumberLast4" TEXT,
    "accountHolderName" TEXT NOT NULL,
    "qrBankingInfo" JSONB,
    "status" "ProviderBankAccountStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ProviderBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderTaxProfile" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "taxCodeHash" TEXT,
    "taxCodeLast4" TEXT,
    "legalName" TEXT NOT NULL,
    "registeredAddress" TEXT NOT NULL,
    "status" "ProviderTaxProfileStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderTaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderAgreement" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "type" "ProviderAgreementType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderVerificationLog" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderVerificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSession" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "appVersion" TEXT,
    "loggedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderDevice" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxPolicyVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaxPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "scope" "TaxRuleScope" NOT NULL DEFAULT 'DEFAULT',
    "serviceType" TEXT,
    "minGrossAmount" INTEGER,
    "maxGrossAmount" INTEGER,
    "rateBps" INTEGER NOT NULL DEFAULT 0,
    "fixedAmount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderTaxLog" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "bookingId" TEXT,
    "earningId" TEXT,
    "taxProfileId" TEXT,
    "policyVersionId" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "taxableAmount" INTEGER NOT NULL,
    "withholdingAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "ruleSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderTaxLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithholdingLog" (
    "id" TEXT NOT NULL,
    "providerTaxLogId" TEXT NOT NULL,
    "payoutBatchId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithholdingLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderKyc_providerProfileId_key" ON "ProviderKyc"("providerProfileId");
CREATE UNIQUE INDEX "ProviderDocument_fileAssetId_key" ON "ProviderDocument"("fileAssetId");
CREATE INDEX "ProviderDocument_providerProfileId_type_status_idx" ON "ProviderDocument"("providerProfileId", "type", "status");
CREATE INDEX "ProviderBankAccount_providerProfileId_status_idx" ON "ProviderBankAccount"("providerProfileId", "status");
CREATE UNIQUE INDEX "ProviderTaxProfile_providerProfileId_key" ON "ProviderTaxProfile"("providerProfileId");
CREATE INDEX "ProviderAgreement_providerProfileId_type_acceptedAt_idx" ON "ProviderAgreement"("providerProfileId", "type", "acceptedAt");
CREATE UNIQUE INDEX "ProviderAgreement_providerProfileId_type_version_key" ON "ProviderAgreement"("providerProfileId", "type", "version");
CREATE INDEX "ProviderVerificationLog_providerProfileId_createdAt_idx" ON "ProviderVerificationLog"("providerProfileId", "createdAt");
CREATE INDEX "ProviderVerificationLog_actorId_createdAt_idx" ON "ProviderVerificationLog"("actorId", "createdAt");
CREATE INDEX "ProviderSession_providerProfileId_lastSeenAt_idx" ON "ProviderSession"("providerProfileId", "lastSeenAt");
CREATE INDEX "ProviderSession_deviceId_idx" ON "ProviderSession"("deviceId");
CREATE INDEX "ProviderDevice_providerProfileId_enabled_idx" ON "ProviderDevice"("providerProfileId", "enabled");
CREATE UNIQUE INDEX "ProviderDevice_providerProfileId_deviceId_key" ON "ProviderDevice"("providerProfileId", "deviceId");
CREATE INDEX "TaxPolicyVersion_status_effectiveFrom_idx" ON "TaxPolicyVersion"("status", "effectiveFrom");
CREATE INDEX "TaxRule_policyVersionId_scope_active_idx" ON "TaxRule"("policyVersionId", "scope", "active");
CREATE INDEX "ProviderTaxLog_providerProfileId_createdAt_idx" ON "ProviderTaxLog"("providerProfileId", "createdAt");
CREATE INDEX "ProviderTaxLog_bookingId_idx" ON "ProviderTaxLog"("bookingId");
CREATE INDEX "ProviderTaxLog_earningId_idx" ON "ProviderTaxLog"("earningId");
CREATE INDEX "WithholdingLog_payoutBatchId_status_idx" ON "WithholdingLog"("payoutBatchId", "status");

ALTER TABLE "ProviderKyc" ADD CONSTRAINT "ProviderKyc_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderBankAccount" ADD CONSTRAINT "ProviderBankAccount_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxProfile" ADD CONSTRAINT "ProviderTaxProfile_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderAgreement" ADD CONSTRAINT "ProviderAgreement_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderVerificationLog" ADD CONSTRAINT "ProviderVerificationLog_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderVerificationLog" ADD CONSTRAINT "ProviderVerificationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderSession" ADD CONSTRAINT "ProviderSession_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderDevice" ADD CONSTRAINT "ProviderDevice_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxPolicyVersion" ADD CONSTRAINT "TaxPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "TaxPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxLog" ADD CONSTRAINT "ProviderTaxLog_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxLog" ADD CONSTRAINT "ProviderTaxLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxLog" ADD CONSTRAINT "ProviderTaxLog_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "ProviderEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxLog" ADD CONSTRAINT "ProviderTaxLog_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "ProviderTaxProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderTaxLog" ADD CONSTRAINT "ProviderTaxLog_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "TaxPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WithholdingLog" ADD CONSTRAINT "WithholdingLog_providerTaxLogId_fkey" FOREIGN KEY ("providerTaxLogId") REFERENCES "ProviderTaxLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithholdingLog" ADD CONSTRAINT "WithholdingLog_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "ProviderPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
