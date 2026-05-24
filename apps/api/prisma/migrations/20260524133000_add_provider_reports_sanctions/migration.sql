-- Provider risk operations: reports and sanctions are separated from KYC/verification
-- logs so support, safety, payout, and account-block decisions remain auditable.

CREATE TYPE "ProviderReportSource" AS ENUM ('CUSTOMER', 'PROVIDER', 'ADMIN', 'SYSTEM');
CREATE TYPE "ProviderReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ProviderReportStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ProviderSanctionType" AS ENUM ('WARNING', 'ACCOUNT_BLOCK', 'PAYOUT_HOLD', 'TRUST_BADGE_REMOVAL');
CREATE TYPE "ProviderSanctionStatus" AS ENUM ('ACTIVE', 'LIFTED', 'EXPIRED');

CREATE TABLE "ProviderReport" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "bookingId" TEXT,
    "source" "ProviderReportSource" NOT NULL DEFAULT 'ADMIN',
    "severity" "ProviderReportSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProviderReportStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "reporterUserId" TEXT,
    "assignedAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSanction" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "reportId" TEXT,
    "type" "ProviderSanctionType" NOT NULL,
    "status" "ProviderSanctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "liftedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderSanction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderReport_providerProfileId_status_severity_idx" ON "ProviderReport"("providerProfileId", "status", "severity");
CREATE INDEX "ProviderReport_bookingId_idx" ON "ProviderReport"("bookingId");
CREATE INDEX "ProviderReport_status_severity_createdAt_idx" ON "ProviderReport"("status", "severity", "createdAt");
CREATE INDEX "ProviderReport_assignedAdminId_status_idx" ON "ProviderReport"("assignedAdminId", "status");

CREATE INDEX "ProviderSanction_providerProfileId_status_type_idx" ON "ProviderSanction"("providerProfileId", "status", "type");
CREATE INDEX "ProviderSanction_reportId_idx" ON "ProviderSanction"("reportId");
CREATE INDEX "ProviderSanction_status_startsAt_idx" ON "ProviderSanction"("status", "startsAt");

ALTER TABLE "ProviderReport" ADD CONSTRAINT "ProviderReport_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderReport" ADD CONSTRAINT "ProviderReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderReport" ADD CONSTRAINT "ProviderReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderReport" ADD CONSTRAINT "ProviderReport_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderSanction" ADD CONSTRAINT "ProviderSanction_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderSanction" ADD CONSTRAINT "ProviderSanction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProviderReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderSanction" ADD CONSTRAINT "ProviderSanction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderSanction" ADD CONSTRAINT "ProviderSanction_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
