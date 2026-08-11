ALTER TABLE "ProviderProfile"
ADD COLUMN "bioTranslations" JSONB;

ALTER TABLE "FileAsset"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "FileAsset_ownerUserId_purpose_sortOrder_createdAt_idx"
ON "FileAsset"("ownerUserId", "purpose", "sortOrder", "createdAt");
