-- Add focused indexes for high-volume Finance/Tax list pages.
-- These support paginated all-date/date-range reads without relying on status-only queues.

CREATE INDEX IF NOT EXISTS "AccountingJournalBatch_postedAt_idx"
  ON "AccountingJournalBatch"("postedAt");

CREATE INDEX IF NOT EXISTS "AccountingJournalBatch_status_postedAt_idx"
  ON "AccountingJournalBatch"("status", "postedAt");

CREATE INDEX IF NOT EXISTS "BookingPaymentClearingEntry_occurredAt_idx"
  ON "BookingPaymentClearingEntry"("occurredAt");

CREATE INDEX IF NOT EXISTS "CompanyBankTransaction_occurredAt_idx"
  ON "CompanyBankTransaction"("occurredAt");
