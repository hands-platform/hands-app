-- Approved bank deposits already move the Partner wallet and general ledger.
-- This table only attributes that existing receivable recovery to cash-booking debt evidence.
CREATE TABLE "PartnerBankDepositCashDebtAllocation" (
    "id" TEXT NOT NULL,
    "partnerBankDepositRequestId" TEXT NOT NULL,
    "providerEarningId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "allocatedByAdminId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerBankDepositCashDebtAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PartnerBankDepositCashDebtAllocation_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "pb_deposit_cash_debt_request_earning_key"
ON "PartnerBankDepositCashDebtAllocation"("partnerBankDepositRequestId", "providerEarningId");

CREATE INDEX "pb_deposit_cash_debt_request_created_idx"
ON "PartnerBankDepositCashDebtAllocation"("partnerBankDepositRequestId", "createdAt");

CREATE INDEX "pb_deposit_cash_debt_earning_created_idx"
ON "PartnerBankDepositCashDebtAllocation"("providerEarningId", "createdAt");

CREATE INDEX "pb_deposit_cash_debt_admin_created_idx"
ON "PartnerBankDepositCashDebtAllocation"("allocatedByAdminId", "createdAt");

ALTER TABLE "PartnerBankDepositRequest"
ADD CONSTRAINT "PartnerBankDepositRequest_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerBankDepositCashDebtAllocation"
ADD CONSTRAINT "pb_deposit_cash_debt_request_fkey"
FOREIGN KEY ("partnerBankDepositRequestId") REFERENCES "PartnerBankDepositRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerBankDepositCashDebtAllocation"
ADD CONSTRAINT "pb_deposit_cash_debt_earning_fkey"
FOREIGN KEY ("providerEarningId") REFERENCES "ProviderEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
