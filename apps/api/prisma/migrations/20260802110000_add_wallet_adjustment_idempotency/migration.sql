ALTER TABLE "ManualWalletAdjustmentRequest"
ADD COLUMN "idempotencyKey" TEXT;

UPDATE "ManualWalletAdjustmentRequest"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "ManualWalletAdjustmentRequest"
ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "ManualWalletAdjustmentRequest_idempotencyKey_key"
ON "ManualWalletAdjustmentRequest"("idempotencyKey");
