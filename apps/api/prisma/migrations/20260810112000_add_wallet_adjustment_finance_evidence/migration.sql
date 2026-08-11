ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'FINANCE_EVIDENCE';

ALTER TABLE "FileAsset"
ADD COLUMN "originalName" TEXT;

ALTER TABLE "ManualWalletAdjustmentRequest"
ADD COLUMN "operationalCause" TEXT,
ADD COLUMN "expectedCorrection" TEXT,
ADD COLUMN "caseReference" TEXT,
ADD COLUMN "attachmentFileId" TEXT;

CREATE INDEX "ManualWalletAdjustmentRequest_attachmentFileId_idx"
ON "ManualWalletAdjustmentRequest"("attachmentFileId");

ALTER TABLE "ManualWalletAdjustmentRequest"
ADD CONSTRAINT "ManualWalletAdjustmentRequest_attachmentFileId_fkey"
FOREIGN KEY ("attachmentFileId") REFERENCES "FileAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
