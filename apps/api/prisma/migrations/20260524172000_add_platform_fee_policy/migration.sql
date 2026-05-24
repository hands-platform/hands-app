CREATE TABLE "PlatformFeePolicyVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TaxPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformFeePolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformFeeRule" (
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
    CONSTRAINT "PlatformFeeRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderPlatformFeeLog" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "bookingId" TEXT,
    "earningId" TEXT,
    "policyVersionId" TEXT,
    "grossAmount" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "ruleSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderPlatformFeeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformFeePolicyVersion_status_effectiveFrom_idx" ON "PlatformFeePolicyVersion"("status", "effectiveFrom");
CREATE INDEX "PlatformFeeRule_policyVersionId_scope_active_idx" ON "PlatformFeeRule"("policyVersionId", "scope", "active");
CREATE INDEX "ProviderPlatformFeeLog_providerProfileId_createdAt_idx" ON "ProviderPlatformFeeLog"("providerProfileId", "createdAt");
CREATE INDEX "ProviderPlatformFeeLog_bookingId_idx" ON "ProviderPlatformFeeLog"("bookingId");
CREATE INDEX "ProviderPlatformFeeLog_earningId_idx" ON "ProviderPlatformFeeLog"("earningId");

ALTER TABLE "PlatformFeePolicyVersion" ADD CONSTRAINT "PlatformFeePolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformFeeRule" ADD CONSTRAINT "PlatformFeeRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PlatformFeePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderPlatformFeeLog" ADD CONSTRAINT "ProviderPlatformFeeLog_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderPlatformFeeLog" ADD CONSTRAINT "ProviderPlatformFeeLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderPlatformFeeLog" ADD CONSTRAINT "ProviderPlatformFeeLog_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "ProviderEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderPlatformFeeLog" ADD CONSTRAINT "ProviderPlatformFeeLog_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PlatformFeePolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PlatformFeePolicyVersion" ("id", "name", "status", "effectiveFrom", "notes", "createdAt", "updatedAt")
VALUES (
    'platform-fee-vn-mvp-2026',
    'HANDS Vietnam MVP platform fee',
    'ACTIVE',
    '2026-01-01T00:00:00.000Z',
    'Default MVP platform fee. Update via admin policy tooling before production.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
    "status" = EXCLUDED."status",
    "effectiveFrom" = EXCLUDED."effectiveFrom",
    "notes" = EXCLUDED."notes",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlatformFeeRule" ("id", "policyVersionId", "scope", "rateBps", "fixedAmount", "active", "createdAt", "updatedAt")
VALUES (
    'platform-fee-rule-default-20pct',
    'platform-fee-vn-mvp-2026',
    'DEFAULT',
    2000,
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
    "rateBps" = EXCLUDED."rateBps",
    "fixedAmount" = EXCLUDED."fixedAmount",
    "active" = EXCLUDED."active",
    "updatedAt" = CURRENT_TIMESTAMP;
