ALTER TABLE "AdminOperatorCredential"
ADD COLUMN "mfaSecretEncrypted" TEXT,
ADD COLUMN "mfaRecoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);

ALTER TABLE "AdminWebSession"
ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

-- Earlier VERIFIED values were readiness placeholders and have no cryptographic secret.
UPDATE "AdminOperatorCredential"
SET "mfaState" = 'NOT_CONFIGURED'
WHERE "mfaState" <> 'NOT_CONFIGURED';
