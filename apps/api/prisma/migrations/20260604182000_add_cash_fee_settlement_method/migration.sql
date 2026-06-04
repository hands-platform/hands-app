CREATE TYPE "CashFeeSettlementMethod" AS ENUM ('PARTNER_DEPOSIT', 'ADMIN_OFFSET');

ALTER TABLE "ProviderEarning"
  ADD COLUMN "settlementMethod" "CashFeeSettlementMethod";

CREATE INDEX "ProviderEarning_settlementMethod_paidAt_idx"
  ON "ProviderEarning"("settlementMethod", "paidAt");
