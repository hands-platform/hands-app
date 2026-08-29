\set ON_ERROR_STOP on

\if :{?snapshot_count}
\else
\set snapshot_count 100000
\endif

\if :{?reversal_count}
\else
\set reversal_count 30000
\endif

SELECT current_database() LIKE 'massage_vn_perf_%' AS target_ok \gset
\if :target_ok
\else
  \echo 'Refusing to seed a database outside the massage_vn_perf_* namespace.'
  \quit 3
\endif

SELECT (:snapshot_count)::integer >= (:reversal_count)::integer
  AND (:reversal_count)::integer > 0 AS counts_ok \gset
\if :counts_ok
\else
  \echo 'snapshot_count must be greater than or equal to reversal_count, and both must be positive.'
  \quit 4
\endif

SELECT NOT EXISTS (
  SELECT 1 FROM "BookingSettlementSnapshot" WHERE "id" LIKE 'perf-syn-%'
) AS target_empty \gset
\if :target_empty
\else
  \echo 'Synthetic capacity rows already exist; refusing to append a second dataset.'
  \quit 5
\endif

BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';
SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = '2s';
SET LOCAL session_replication_role = replica;

WITH generated AS (
  SELECT
    series AS sequence,
    TIMESTAMP '2024-01-01 00:00:00'
      + ((series % 730) * INTERVAL '1 day')
      + ((series % 1440) * INTERVAL '1 minute') AS activity_at
  FROM generate_series(1, :snapshot_count) AS series
)
INSERT INTO "BookingSettlementSnapshot" (
  "id",
  "sourceKey",
  "bookingId",
  "customerProfileId",
  "providerProfileId",
  "paymentMethod",
  "customerPaymentAmount",
  "partnerPayoutAmount",
  "partnerTaxableRevenue",
  "partnerVatRateBps",
  "partnerVatAmount",
  "partnerPitRateBps",
  "partnerPitAmount",
  "partnerWithholdingTotal",
  "platformFeeGross",
  "platformVatRateBps",
  "platformFeeNetRevenue",
  "companyOutputVat",
  "paymentProcessingFee",
  "settlementStatus",
  "taxStatus",
  "monthlyPeriod",
  "postedAt",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  FORMAT('perf-syn-snapshot-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn:booking-settlement:%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn-booking-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn-customer-%s', LPAD(((sequence - 1) % 25000 + 1)::text, 6, '0')),
  FORMAT('perf-syn-partner-%s', LPAD(((sequence - 1) % 5000 + 1)::text, 5, '0')),
  (CASE sequence % 7
    WHEN 0 THEN 'CASH'
    WHEN 1 THEN 'CUSTOMER_WALLET'
    WHEN 2 THEN 'CARD'
    WHEN 3 THEN 'MOMO'
    WHEN 4 THEN 'VNPAY'
    WHEN 5 THEN 'BANK_TRANSFER'
    ELSE 'MANUAL'
  END)::"PaymentMethod",
  500000,
  350000,
  370000,
  500,
  10000,
  500,
  10000,
  20000,
  120000,
  1000,
  109091,
  10909,
  10000,
  'POSTED'::"BookingSettlementStatus",
  (CASE
    WHEN sequence % 20 = 0 THEN 'OPEN'
    WHEN sequence % 5 = 0 THEN 'DECLARED'
    WHEN sequence % 3 = 0 THEN 'PAID'
    ELSE 'CLOSED'
  END)::"BookingSettlementTaxStatus",
  TO_CHAR(activity_at, 'YYYY-MM'),
  activity_at,
  CASE WHEN sequence % 3 = 0 THEN JSONB_BUILD_OBJECT(
    'bookingServiceAmount', 500000,
    'companyCouponExpense', 30000,
    'couponCodeSnapshot', FORMAT('PERF-%s', LPAD(((sequence - 1) % 1000 + 1)::text, 4, '0')),
    'couponDiscountAmount', 50000,
    'couponId', FORMAT('perf-syn-coupon-%s', LPAD(((sequence - 1) % 1000 + 1)::text, 4, '0')),
    'customerPaidAmount', 450000,
    'partnerFundedCouponAmount', 20000,
    'platformFeeDiscountAmount', 0,
    'settlementBaseAmount', 500000
  ) ELSE '{}'::jsonb END,
  activity_at,
  activity_at
FROM generated;

WITH generated AS (
  SELECT
    series AS sequence,
    1 + ((series - 1) * FLOOR((:snapshot_count)::numeric / (:reversal_count)::numeric))::integer
      AS snapshot_sequence,
    TIMESTAMP '2026-01-01 00:00:00'
      + ((series % 240) * INTERVAL '1 day')
      + ((series % 1440) * INTERVAL '1 minute') AS activity_at
  FROM generate_series(1, :reversal_count) AS series
)
INSERT INTO "BookingSettlementReversalEntry" (
  "id",
  "sourceKey",
  "originalSettlementSnapshotId",
  "bookingId",
  "customerProfileId",
  "providerProfileId",
  "paymentMethod",
  "customerPaymentAmount",
  "partnerPayoutAmount",
  "partnerTaxableRevenue",
  "partnerVatAmount",
  "partnerPitAmount",
  "partnerWithholdingTotal",
  "platformFeeGross",
  "platformFeeNetRevenue",
  "companyOutputVat",
  "paymentProcessingFee",
  "settlementStatus",
  "taxStatus",
  "monthlyPeriod",
  "originalMonthlyPeriod",
  "originalMonthlyClosingId",
  "occurredAt",
  "reason",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  FORMAT('perf-syn-reversal-%s', LPAD(sequence::text, 7, '0')),
  FORMAT('perf-syn:booking-settlement-reversal:%s', LPAD(sequence::text, 7, '0')),
  FORMAT('perf-syn-snapshot-%s', LPAD(snapshot_sequence::text, 8, '0')),
  FORMAT('perf-syn-booking-%s', LPAD(snapshot_sequence::text, 8, '0')),
  FORMAT('perf-syn-customer-%s', LPAD(((snapshot_sequence - 1) % 25000 + 1)::text, 6, '0')),
  FORMAT('perf-syn-partner-%s', LPAD(((snapshot_sequence - 1) % 5000 + 1)::text, 5, '0')),
  (CASE sequence % 7
    WHEN 0 THEN 'CASH'
    WHEN 1 THEN 'CUSTOMER_WALLET'
    WHEN 2 THEN 'CARD'
    WHEN 3 THEN 'MOMO'
    WHEN 4 THEN 'VNPAY'
    WHEN 5 THEN 'BANK_TRANSFER'
    ELSE 'MANUAL'
  END)::"PaymentMethod",
  -500000,
  -350000,
  -370000,
  -10000,
  -10000,
  -20000,
  -120000,
  -109091,
  -10909,
  -10000,
  'REVERSED'::"BookingSettlementStatus",
  (CASE WHEN sequence % 10 = 0 THEN 'OPEN' ELSE 'REVERSED' END)::"BookingSettlementTaxStatus",
  TO_CHAR(activity_at, 'YYYY-MM'),
  TO_CHAR(activity_at - INTERVAL '1 month', 'YYYY-MM'),
  FORMAT('perf-syn-closing-%s', TO_CHAR(activity_at - INTERVAL '1 month', 'YYYY-MM')),
  activity_at,
  'Synthetic capacity reversal',
  JSONB_BUILD_OBJECT(
    'couponCodeSnapshot', FORMAT('PERF-%s', LPAD(((sequence - 1) % 1000 + 1)::text, 4, '0')),
    'couponId', FORMAT('perf-syn-coupon-%s', LPAD(((sequence - 1) % 1000 + 1)::text, 4, '0')),
    'partnerFundedCouponAmount', 20000,
    'platformFeeDiscountAmount', 0,
    'reversedCompanyCouponExpense', 30000,
    'reversedCouponDiscountAmount', 50000
  ),
  activity_at,
  activity_at
FROM generated;

WITH generated AS (
  SELECT
    series AS sequence,
    TIMESTAMP '2024-01-01 00:00:00'
      + ((series % 730) * INTERVAL '1 day')
      + ((series % 1440) * INTERVAL '1 minute') AS activity_at
  FROM generate_series(1, :snapshot_count) AS series
)
INSERT INTO "AccountingJournalBatch" (
  "id",
  "sourceKey",
  "sourceType",
  "sourceId",
  "bookingId",
  "customerProfileId",
  "providerProfileId",
  "settlementSnapshotId",
  "monthlyPeriod",
  "status",
  "totalDebit",
  "totalCredit",
  "postedAt",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  FORMAT('perf-syn-journal-settlement-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn:journal:booking-settlement:%s', LPAD(sequence::text, 8, '0')),
  'BOOKING_SETTLEMENT'::"AccountingJournalSourceType",
  FORMAT('perf-syn-snapshot-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn-booking-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn-customer-%s', LPAD(((sequence - 1) % 25000 + 1)::text, 6, '0')),
  FORMAT('perf-syn-partner-%s', LPAD(((sequence - 1) % 5000 + 1)::text, 5, '0')),
  FORMAT('perf-syn-snapshot-%s', LPAD(sequence::text, 8, '0')),
  TO_CHAR(activity_at, 'YYYY-MM'),
  'POSTED'::"AccountingJournalBatchStatus",
  500000,
  CASE WHEN sequence % 50 = 0 THEN 490000 ELSE 500000 END,
  activity_at,
  JSONB_BUILD_OBJECT('reconciliationDelta', 0, 'syntheticCapacity', true),
  activity_at,
  activity_at
FROM generated;

WITH generated AS (
  SELECT
    series AS sequence,
    TIMESTAMP '2026-01-01 00:00:00'
      + ((series % 240) * INTERVAL '1 day')
      + ((series % 1440) * INTERVAL '1 minute') AS activity_at
  FROM generate_series(1, :reversal_count) AS series
)
INSERT INTO "AccountingJournalBatch" (
  "id",
  "sourceKey",
  "sourceType",
  "sourceId",
  "bookingId",
  "customerProfileId",
  "providerProfileId",
  "settlementReversalEntryId",
  "monthlyPeriod",
  "status",
  "totalDebit",
  "totalCredit",
  "postedAt",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  FORMAT('perf-syn-journal-reversal-%s', LPAD(sequence::text, 7, '0')),
  FORMAT('perf-syn:journal:booking-settlement-reversal:%s', LPAD(sequence::text, 7, '0')),
  'BOOKING_SETTLEMENT_REVERSAL'::"AccountingJournalSourceType",
  FORMAT('perf-syn-reversal-%s', LPAD(sequence::text, 7, '0')),
  FORMAT('perf-syn-booking-%s', LPAD(sequence::text, 8, '0')),
  FORMAT('perf-syn-customer-%s', LPAD(((sequence - 1) % 25000 + 1)::text, 6, '0')),
  FORMAT('perf-syn-partner-%s', LPAD(((sequence - 1) % 5000 + 1)::text, 5, '0')),
  FORMAT('perf-syn-reversal-%s', LPAD(sequence::text, 7, '0')),
  TO_CHAR(activity_at, 'YYYY-MM'),
  'POSTED'::"AccountingJournalBatchStatus",
  500000,
  CASE WHEN sequence % 10 = 0 THEN 490000 ELSE 500000 END,
  activity_at,
  JSONB_BUILD_OBJECT('reconciliationDelta', 0, 'syntheticCapacity', true),
  activity_at,
  activity_at
FROM generated;

INSERT INTO "AccountingJournalEntry" (
  "id",
  "batchId",
  "side",
  "accountCode",
  "accountName",
  "amount",
  "sourceType",
  "sourceId",
  "metadata",
  "createdAt"
)
SELECT
  FORMAT('perf-syn-entry-settlement-%s-%s', LPAD(series::text, 8, '0'), LOWER(entry.side)),
  FORMAT('perf-syn-journal-settlement-%s', LPAD(series::text, 8, '0')),
  entry.side::"AccountingJournalEntrySide",
  CASE WHEN entry.side = 'DEBIT' THEN 'customer_receivable' ELSE 'settlement_offset' END,
  CASE WHEN entry.side = 'DEBIT' THEN 'Customer receivable' ELSE 'Settlement offset' END,
  500000,
  'BOOKING_SETTLEMENT'::"AccountingJournalSourceType",
  FORMAT('perf-syn-snapshot-%s', LPAD(series::text, 8, '0')),
  JSONB_BUILD_OBJECT('syntheticCapacity', true),
  TIMESTAMP '2024-01-01 00:00:00' + ((series % 730) * INTERVAL '1 day')
FROM generate_series(1, :snapshot_count) AS series
CROSS JOIN (VALUES ('DEBIT'), ('CREDIT')) AS entry(side);

INSERT INTO "AccountingJournalEntry" (
  "id",
  "batchId",
  "side",
  "accountCode",
  "accountName",
  "amount",
  "sourceType",
  "sourceId",
  "metadata",
  "createdAt"
)
SELECT
  FORMAT('perf-syn-entry-reversal-%s-%s', LPAD(series::text, 7, '0'), LOWER(entry.side)),
  FORMAT('perf-syn-journal-reversal-%s', LPAD(series::text, 7, '0')),
  entry.side::"AccountingJournalEntrySide",
  CASE
    WHEN entry.side = 'CREDIT' THEN 'settlement_offset'
    WHEN series % 7 = 0 THEN 'partner_receivable_negative_wallet'
    WHEN series % 7 = 1 THEN 'customer_wallet_liability'
    ELSE 'refund_clearing'
  END,
  CASE WHEN entry.side = 'CREDIT' THEN 'Settlement offset' ELSE 'Reversal evidence' END,
  500000,
  'BOOKING_SETTLEMENT_REVERSAL'::"AccountingJournalSourceType",
  FORMAT('perf-syn-reversal-%s', LPAD(series::text, 7, '0')),
  JSONB_BUILD_OBJECT('syntheticCapacity', true),
  TIMESTAMP '2026-01-01 00:00:00' + ((series % 240) * INTERVAL '1 day')
FROM generate_series(1, :reversal_count) AS series
CROSS JOIN (VALUES ('DEBIT'), ('CREDIT')) AS entry(side);

COMMIT;

ANALYZE "BookingSettlementSnapshot";
ANALYZE "BookingSettlementReversalEntry";
ANALYZE "AccountingJournalBatch";
ANALYZE "AccountingJournalEntry";

SELECT 'snapshots' AS relation, COUNT(*)::bigint AS synthetic_rows
FROM "BookingSettlementSnapshot" WHERE "id" LIKE 'perf-syn-%'
UNION ALL
SELECT 'reversals', COUNT(*)::bigint
FROM "BookingSettlementReversalEntry" WHERE "id" LIKE 'perf-syn-%'
UNION ALL
SELECT 'journal_batches', COUNT(*)::bigint
FROM "AccountingJournalBatch" WHERE "id" LIKE 'perf-syn-%'
UNION ALL
SELECT 'journal_entries', COUNT(*)::bigint
FROM "AccountingJournalEntry" WHERE "id" LIKE 'perf-syn-%'
ORDER BY relation;
