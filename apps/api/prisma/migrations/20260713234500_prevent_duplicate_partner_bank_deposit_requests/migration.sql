CREATE UNIQUE INDEX "PartnerBankDepositRequest_providerProfileId_bankTransactionId_key"
  ON "PartnerBankDepositRequest"("providerProfileId", "bankTransactionId");
