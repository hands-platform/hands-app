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
  -- Serialize aggregate refreshes for one Partner/currency ledger bucket.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(target_provider_profile_id || ':' || target_currency, 0)
  );

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
