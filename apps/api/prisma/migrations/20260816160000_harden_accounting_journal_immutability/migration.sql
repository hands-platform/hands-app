-- Posted accounting journals and closed-period settlement reversals are evidence.
-- Corrections must be represented by a new reversal record, never by rewriting history.
CREATE OR REPLACE FUNCTION reject_accounting_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is append-only; write a reversal record instead', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  IF (to_jsonb(NEW) - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt') THEN
    RAISE EXCEPTION '% is append-only; source-key replays must not change accounting evidence', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  NEW."updatedAt" := OLD."updatedAt";
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reject_accounting_journal_entry_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is append-only; write a reversal record instead', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;

  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION '% is append-only; source-key replays must not change accounting evidence', TG_TABLE_NAME
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "AccountingJournalBatch_reject_mutation" ON "AccountingJournalBatch";
CREATE TRIGGER "AccountingJournalBatch_reject_mutation"
BEFORE UPDATE OR DELETE ON "AccountingJournalBatch"
FOR EACH ROW
EXECUTE FUNCTION reject_accounting_evidence_mutation();

DROP TRIGGER IF EXISTS "AccountingJournalEntry_reject_mutation" ON "AccountingJournalEntry";
CREATE TRIGGER "AccountingJournalEntry_reject_mutation"
BEFORE UPDATE OR DELETE ON "AccountingJournalEntry"
FOR EACH ROW
EXECUTE FUNCTION reject_accounting_journal_entry_mutation();

DROP TRIGGER IF EXISTS "BookingSettlementReversalEntry_reject_mutation" ON "BookingSettlementReversalEntry";
CREATE TRIGGER "BookingSettlementReversalEntry_reject_mutation"
BEFORE UPDATE OR DELETE ON "BookingSettlementReversalEntry"
FOR EACH ROW
EXECUTE FUNCTION reject_accounting_evidence_mutation();
