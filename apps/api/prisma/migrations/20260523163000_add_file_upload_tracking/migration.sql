CREATE TYPE "FilePurpose" AS ENUM ('PROVIDER_VERIFICATION', 'PROVIDER_GALLERY', 'CHAT_ATTACHMENT', 'PROFILE_IMAGE');

CREATE TYPE "FileUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

ALTER TABLE "FileAsset"
  ADD COLUMN "purpose" "FilePurpose" NOT NULL DEFAULT 'PROVIDER_VERIFICATION',
  ADD COLUMN "uploadStatus" "FileUploadStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "uploadedAt" TIMESTAMP(3),
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "FileAsset_ownerUserId_purpose_createdAt_idx" ON "FileAsset"("ownerUserId", "purpose", "createdAt");
CREATE INDEX "FileAsset_visibility_purpose_createdAt_idx" ON "FileAsset"("visibility", "purpose", "createdAt");

ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
