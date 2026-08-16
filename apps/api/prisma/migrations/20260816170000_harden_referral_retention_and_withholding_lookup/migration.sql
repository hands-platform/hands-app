-- Preserve referral and reward evidence when a profile is removed. The relation
-- columns are nullable, so the historical rows remain usable for audit purposes.
ALTER TABLE "ReferralCode"
  DROP CONSTRAINT "ReferralCode_ownerCustomerProfileId_fkey",
  DROP CONSTRAINT "ReferralCode_ownerProviderProfileId_fkey";

ALTER TABLE "ReferralCode"
  ADD CONSTRAINT "ReferralCode_ownerCustomerProfileId_fkey"
    FOREIGN KEY ("ownerCustomerProfileId") REFERENCES "CustomerProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralCode_ownerProviderProfileId_fkey"
    FOREIGN KEY ("ownerProviderProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReferralAttribution"
  DROP CONSTRAINT "ReferralAttribution_referrerCustomerProfileId_fkey",
  DROP CONSTRAINT "ReferralAttribution_referrerProviderProfileId_fkey",
  DROP CONSTRAINT "ReferralAttribution_referredCustomerProfileId_fkey",
  DROP CONSTRAINT "ReferralAttribution_referredProviderProfileId_fkey";

ALTER TABLE "ReferralAttribution"
  ADD CONSTRAINT "ReferralAttribution_referrerCustomerProfileId_fkey"
    FOREIGN KEY ("referrerCustomerProfileId") REFERENCES "CustomerProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralAttribution_referrerProviderProfileId_fkey"
    FOREIGN KEY ("referrerProviderProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralAttribution_referredCustomerProfileId_fkey"
    FOREIGN KEY ("referredCustomerProfileId") REFERENCES "CustomerProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralAttribution_referredProviderProfileId_fkey"
    FOREIGN KEY ("referredProviderProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
  DROP CONSTRAINT "ReferralReward_walletOwnerCustomerProfileId_fkey",
  DROP CONSTRAINT "ReferralReward_walletOwnerProviderProfileId_fkey";

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_walletOwnerCustomerProfileId_fkey"
    FOREIGN KEY ("walletOwnerCustomerProfileId") REFERENCES "CustomerProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralReward_walletOwnerProviderProfileId_fkey"
    FOREIGN KEY ("walletOwnerProviderProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WithholdingLog_providerTaxLogId_idx"
  ON "WithholdingLog"("providerTaxLogId");
