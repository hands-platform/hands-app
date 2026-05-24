CREATE TYPE "FileReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "FileAsset"
  ADD COLUMN "reviewStatus" "FileReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewReason" TEXT,
  ADD COLUMN "reviewedById" TEXT;

ALTER TABLE "FileAsset"
  ADD CONSTRAINT "FileAsset_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FileAsset_reviewStatus_purpose_createdAt_idx"
  ON "FileAsset"("reviewStatus", "purpose", "createdAt");
