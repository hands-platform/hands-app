-- Admin operator access lifecycle is deliberately separate from mobile AppSession.
ALTER TABLE "AdminOperatorPermission"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AdminOperatorCredential"
ADD COLUMN "setupCompletedAt" TIMESTAMP(3),
ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "disabledReason" TEXT,
ADD COLUMN "mfaState" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED';

UPDATE "AdminOperatorCredential"
SET "setupCompletedAt" = "createdAt"
WHERE "setupCompletedAt" IS NULL;

CREATE UNIQUE INDEX "AdminOperatorCredential_email_normalized_key"
ON "AdminOperatorCredential" (LOWER("email"));
CREATE INDEX "AdminOperatorCredential_disabledAt_idx"
ON "AdminOperatorCredential"("disabledAt");
CREATE INDEX "AdminOperatorCredential_lockedUntil_idx"
ON "AdminOperatorCredential"("lockedUntil");

CREATE TABLE "AdminOperatorInvitation" (
  "id" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "pendingKey" TEXT,
  "fullName" TEXT,
  "targetUserId" TEXT,
  "permissionCategories" "AdminOperatorPermissionCategory"[],
  "masterAdminEnabled" BOOLEAN NOT NULL DEFAULT false,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "invitedByAdminId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminOperatorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOperatorInvitation_pendingKey_key"
ON "AdminOperatorInvitation"("pendingKey");
CREATE UNIQUE INDEX "AdminOperatorInvitation_tokenHash_key"
ON "AdminOperatorInvitation"("tokenHash");
CREATE INDEX "AdminOperatorInvitation_normalizedEmail_createdAt_idx"
ON "AdminOperatorInvitation"("normalizedEmail", "createdAt");
CREATE INDEX "AdminOperatorInvitation_expiresAt_idx"
ON "AdminOperatorInvitation"("expiresAt");
CREATE INDEX "AdminOperatorInvitation_targetUserId_createdAt_idx"
ON "AdminOperatorInvitation"("targetUserId", "createdAt");

ALTER TABLE "AdminOperatorInvitation"
ADD CONSTRAINT "AdminOperatorInvitation_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminOperatorInvitation"
ADD CONSTRAINT "AdminOperatorInvitation_invitedByAdminId_fkey"
FOREIGN KEY ("invitedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdminWebSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedByAdminId" TEXT,
  "revocationReason" TEXT,
  "platformSummary" TEXT,
  "reauthenticatedAt" TIMESTAMP(3),
  CONSTRAINT "AdminWebSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminWebSession_userId_expiresAt_idx"
ON "AdminWebSession"("userId", "expiresAt");
CREATE INDEX "AdminWebSession_revokedAt_expiresAt_idx"
ON "AdminWebSession"("revokedAt", "expiresAt");

ALTER TABLE "AdminWebSession"
ADD CONSTRAINT "AdminWebSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminWebSession"
ADD CONSTRAINT "AdminWebSession_revokedByAdminId_fkey"
FOREIGN KEY ("revokedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
