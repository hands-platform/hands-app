ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'BOOKINGS_REALTIME';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'BOOKINGS_IN_PROGRESS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'BOOKINGS_COMPLETED';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'BOOKINGS_CANCELLATIONS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'BOOKINGS_DETAIL';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CUSTOMERS_DIRECTORY';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CUSTOMERS_DETAIL';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CUSTOMERS_REVIEWS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'PARTNERS_DIRECTORY';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'PARTNERS_UNAPPROVED';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'PARTNERS_DETAIL';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'PARTNERS_KYC';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_PAYMENT_CLEARING';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_GENERAL_LEDGER';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_BANK_RECONCILIATION';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_WALLET_ADJUSTMENTS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_SETTLEMENTS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'FINANCE_TAX';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'NOTIFICATIONS_TEMPLATES';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'NOTIFICATIONS_PUSH';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'NOTIFICATIONS_DELIVERY';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_SERVICES';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_COUPONS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN_OPERATORS';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_POLICY';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_AUDIT';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'SYSTEM_SETUP';

CREATE TABLE "AdminOperatorCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordSalt" TEXT NOT NULL,
  "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminOperatorCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOperatorCredential_userId_key" ON "AdminOperatorCredential"("userId");
CREATE UNIQUE INDEX "AdminOperatorCredential_email_key" ON "AdminOperatorCredential"("email");
CREATE INDEX "AdminOperatorCredential_updatedAt_idx" ON "AdminOperatorCredential"("updatedAt");

ALTER TABLE "AdminOperatorCredential"
  ADD CONSTRAINT "AdminOperatorCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
