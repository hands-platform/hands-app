ALTER TABLE "Refund" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'VND';
ALTER TABLE "Refund" ADD COLUMN "metadata" JSONB;

CREATE INDEX "Refund_bookingId_createdAt_idx" ON "Refund"("bookingId", "createdAt");
CREATE INDEX "Refund_paymentId_createdAt_idx" ON "Refund"("paymentId", "createdAt");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
