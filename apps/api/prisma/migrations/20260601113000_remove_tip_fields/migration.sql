-- HANDS MVP does not include tips.
-- Keep service pricing, platform fees, withholding, and wallet settlement as the only money movements.

ALTER TABLE "Review" DROP COLUMN IF EXISTS "tipAmount";
ALTER TABLE "ProviderEarning" DROP COLUMN IF EXISTS "tipAmount";
