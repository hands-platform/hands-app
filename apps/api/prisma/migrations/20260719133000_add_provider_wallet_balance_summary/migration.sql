CREATE TABLE "ProviderWalletBalanceSummary" (
  "providerProfileId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "balance" BIGINT NOT NULL DEFAULT 0,
  "entryCount" INTEGER NOT NULL DEFAULT 0,
  "lastEntryAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProviderWalletBalanceSummary_pkey"
    PRIMARY KEY ("providerProfileId", "currency")
);

CREATE INDEX "ProviderWalletBalanceSummary_currency_balance_idx"
  ON "ProviderWalletBalanceSummary"("currency", "balance");

ALTER TABLE "ProviderWalletBalanceSummary"
  ADD CONSTRAINT "ProviderWalletBalanceSummary_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProviderWalletBalanceSummary" (
  "providerProfileId",
  "currency",
  "balance",
  "entryCount",
  "lastEntryAt",
  "updatedAt"
)
SELECT
  "providerProfileId",
  "currency",
  COALESCE(SUM("amount"), 0),
  COUNT(*)::INTEGER,
  MAX("createdAt"),
  CURRENT_TIMESTAMP
FROM "ProviderWalletLedgerEntry"
GROUP BY "providerProfileId", "currency";

CREATE OR REPLACE FUNCTION refresh_provider_wallet_balance_summary(
  target_provider_profile_id TEXT,
  target_currency TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  aggregate_balance BIGINT;
  aggregate_entry_count INTEGER;
  aggregate_last_entry_at TIMESTAMP(3);
BEGIN
  SELECT
    COALESCE(SUM("amount"), 0),
    COUNT(*)::INTEGER,
    MAX("createdAt")
  INTO
    aggregate_balance,
    aggregate_entry_count,
    aggregate_last_entry_at
  FROM "ProviderWalletLedgerEntry"
  WHERE "providerProfileId" = target_provider_profile_id
    AND "currency" = target_currency;

  IF aggregate_entry_count = 0 THEN
    DELETE FROM "ProviderWalletBalanceSummary"
    WHERE "providerProfileId" = target_provider_profile_id
      AND "currency" = target_currency;
    RETURN;
  END IF;

  INSERT INTO "ProviderWalletBalanceSummary" (
    "providerProfileId",
    "currency",
    "balance",
    "entryCount",
    "lastEntryAt",
    "updatedAt"
  ) VALUES (
    target_provider_profile_id,
    target_currency,
    aggregate_balance,
    aggregate_entry_count,
    aggregate_last_entry_at,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("providerProfileId", "currency") DO UPDATE SET
    "balance" = EXCLUDED."balance",
    "entryCount" = EXCLUDED."entryCount",
    "lastEntryAt" = EXCLUDED."lastEntryAt",
    "updatedAt" = CURRENT_TIMESTAMP;
END;
$function$;

CREATE OR REPLACE FUNCTION sync_provider_wallet_balance_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_provider_wallet_balance_summary(OLD."providerProfileId", OLD."currency");
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM refresh_provider_wallet_balance_summary(OLD."providerProfileId", OLD."currency");
    IF OLD."providerProfileId" IS DISTINCT FROM NEW."providerProfileId"
      OR OLD."currency" IS DISTINCT FROM NEW."currency" THEN
      PERFORM refresh_provider_wallet_balance_summary(NEW."providerProfileId", NEW."currency");
    END IF;
    RETURN NEW;
  END IF;

  PERFORM refresh_provider_wallet_balance_summary(NEW."providerProfileId", NEW."currency");
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "ProviderWalletLedgerEntry_balance_summary_sync"
AFTER INSERT OR UPDATE OR DELETE ON "ProviderWalletLedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION sync_provider_wallet_balance_summary();
