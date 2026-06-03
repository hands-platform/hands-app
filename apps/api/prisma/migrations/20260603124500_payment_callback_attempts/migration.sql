CREATE TABLE "PaymentCallbackAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "providerRef" TEXT,
    "outcome" TEXT NOT NULL,
    "signatureVerified" BOOLEAN,
    "verificationMode" TEXT,
    "providerStatus" TEXT,
    "gatewayTransactionId" TEXT,
    "callbackAmount" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCallbackAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentCallbackAttempt_paymentId_createdAt_idx" ON "PaymentCallbackAttempt"("paymentId", "createdAt");
CREATE INDEX "PaymentCallbackAttempt_method_outcome_createdAt_idx" ON "PaymentCallbackAttempt"("method", "outcome", "createdAt");
CREATE INDEX "PaymentCallbackAttempt_providerRef_createdAt_idx" ON "PaymentCallbackAttempt"("providerRef", "createdAt");
CREATE INDEX "PaymentCallbackAttempt_createdAt_idx" ON "PaymentCallbackAttempt"("createdAt");

ALTER TABLE "PaymentCallbackAttempt" ADD CONSTRAINT "PaymentCallbackAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
