-- Financial wallet entries are append-only. Corrections must be represented by
-- a distinct reversal entry with its own source key.
CREATE OR REPLACE FUNCTION reject_wallet_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is append-only; write a reversal entry instead', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
    RAISE EXCEPTION '% is append-only; source-key replays must not change financial evidence', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  NEW."updatedAt" := OLD."updatedAt";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ProviderWalletLedgerEntry_reject_mutation" ON "ProviderWalletLedgerEntry";
CREATE TRIGGER "ProviderWalletLedgerEntry_reject_mutation"
BEFORE UPDATE OR DELETE ON "ProviderWalletLedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION reject_wallet_ledger_mutation();

DROP TRIGGER IF EXISTS "CustomerWalletLedgerEntry_reject_mutation" ON "CustomerWalletLedgerEntry";
CREATE TRIGGER "CustomerWalletLedgerEntry_reject_mutation"
BEFORE UPDATE OR DELETE ON "CustomerWalletLedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION reject_wallet_ledger_mutation();

CREATE INDEX IF NOT EXISTS "ProviderPayoutBatch_providerProfileId_createdAt_idx"
ON "ProviderPayoutBatch"("providerProfileId", "createdAt");
