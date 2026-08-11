ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CONTENT_VIEW';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CONTENT_EDIT';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CONTENT_PUBLISH';
ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'CONTENT_DELETE';

CREATE TYPE "PublicSiteRevisionState" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PublicSiteRevisionReadinessState" AS ENUM ('READY', 'BLOCKED', 'UNKNOWN');

ALTER TABLE "PublicSitePage"
ADD COLUMN "activeRevisionId" TEXT,
ADD COLUMN "draftRevisionId" TEXT,
ADD COLUMN "firstPublishedAt" TIMESTAMP(3);

CREATE TABLE "PublicSitePageRevision" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "state" "PublicSiteRevisionState" NOT NULL DEFAULT 'DRAFT',
  "readinessState" "PublicSiteRevisionReadinessState" NOT NULL DEFAULT 'UNKNOWN',
  "readinessIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalPath" TEXT,
  "noIndex" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicSitePageRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicSiteRevisionSection" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "kind" "PublicSiteSectionKind" NOT NULL,
  "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicSiteRevisionSection_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PublicSitePageRevision" (
  "id", "pageId", "revisionNumber", "version", "state", "seoTitle",
  "seoDescription", "canonicalPath", "noIndex", "publishedAt",
  "createdById", "updatedById", "publishedById", "createdAt", "updatedAt"
)
SELECT
  'legacy-revision-' || page."id",
  page."id",
  1,
  1,
  CASE WHEN page."status" = 'PUBLISHED'
    THEN 'ACTIVE'::"PublicSiteRevisionState"
    ELSE 'DRAFT'::"PublicSiteRevisionState"
  END,
  page."seoTitle",
  page."seoDescription",
  page."canonicalPath",
  page."noIndex",
  page."publishedAt",
  page."createdById",
  page."updatedById",
  CASE WHEN page."status" = 'PUBLISHED' THEN page."updatedById" ELSE NULL END,
  page."createdAt",
  page."updatedAt"
FROM "PublicSitePage" page
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PublicSiteRevisionSection" (
  "id", "revisionId", "key", "kind", "content", "sortOrder", "enabled", "createdAt", "updatedAt"
)
SELECT
  'legacy-revision-section-' || section."id",
  'legacy-revision-' || section."pageId",
  section."key",
  section."kind",
  section."content",
  section."sortOrder",
  section."enabled",
  section."createdAt",
  section."updatedAt"
FROM "PublicSiteSection" section
ON CONFLICT ("id") DO NOTHING;

UPDATE "PublicSitePage"
SET
  "activeRevisionId" = CASE WHEN "status" = 'PUBLISHED' THEN 'legacy-revision-' || "id" ELSE NULL END,
  "draftRevisionId" = CASE WHEN "status" = 'DRAFT' THEN 'legacy-revision-' || "id" ELSE NULL END,
  "firstPublishedAt" = CASE WHEN "status" = 'PUBLISHED' THEN "publishedAt" ELSE NULL END;

CREATE UNIQUE INDEX "PublicSitePage_activeRevisionId_key" ON "PublicSitePage"("activeRevisionId");
CREATE UNIQUE INDEX "PublicSitePage_draftRevisionId_key" ON "PublicSitePage"("draftRevisionId");
CREATE UNIQUE INDEX "PublicSitePageRevision_pageId_revisionNumber_key"
ON "PublicSitePageRevision"("pageId", "revisionNumber");
CREATE INDEX "PublicSitePageRevision_pageId_state_updatedAt_idx"
ON "PublicSitePageRevision"("pageId", "state", "updatedAt");
CREATE UNIQUE INDEX "PublicSiteRevisionSection_revisionId_key_key"
ON "PublicSiteRevisionSection"("revisionId", "key");
CREATE INDEX "PublicSiteRevisionSection_revisionId_enabled_sortOrder_idx"
ON "PublicSiteRevisionSection"("revisionId", "enabled", "sortOrder");

ALTER TABLE "PublicSitePageRevision"
ADD CONSTRAINT "PublicSitePageRevision_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "PublicSitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicSiteRevisionSection"
ADD CONSTRAINT "PublicSiteRevisionSection_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "PublicSitePageRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicSitePage"
ADD CONSTRAINT "PublicSitePage_activeRevisionId_fkey"
FOREIGN KEY ("activeRevisionId") REFERENCES "PublicSitePageRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicSitePage"
ADD CONSTRAINT "PublicSitePage_draftRevisionId_fkey"
FOREIGN KEY ("draftRevisionId") REFERENCES "PublicSitePageRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
