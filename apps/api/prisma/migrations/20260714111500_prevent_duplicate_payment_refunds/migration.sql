-- HANDS currently supports one full refund record per payment.
-- Fail closed when legacy duplicates exist instead of deleting financial evidence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Refund"
    GROUP BY "paymentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Refund.paymentId uniqueness while duplicate payment refunds exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "Refund_paymentId_createdAt_idx";
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");
