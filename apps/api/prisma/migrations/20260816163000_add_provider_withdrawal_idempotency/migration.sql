ALTER TABLE "ProviderWalletWithdrawalRequest"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "ProviderWalletWithdrawalRequest_providerProfileId_idempotencyKey_key"
ON "ProviderWalletWithdrawalRequest"("providerProfileId", "idempotencyKey");
