ALTER TABLE "PublicSiteSection"
ADD COLUMN "content" JSONB NOT NULL DEFAULT '{}'::jsonb;
