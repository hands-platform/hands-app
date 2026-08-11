CREATE TYPE "PublicSiteKey" AS ENUM (
  'MAIN',
  'PARTNER_RECRUITMENT'
);

CREATE TYPE "PublicSitePageStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED'
);

CREATE TYPE "PublicSiteSectionKind" AS ENUM (
  'HERO',
  'APP_OVERVIEW',
  'PARTNER_DIRECTORY',
  'PARTNER_DETAIL',
  'RECRUITMENT_BENEFITS',
  'RECRUITMENT_PROCESS',
  'COMPANY_INFORMATION',
  'CONTACT',
  'LEGAL_DOCUMENT',
  'FAQ',
  'CTA'
);

CREATE TABLE "PublicSitePage" (
  "id" TEXT NOT NULL,
  "site" "PublicSiteKey" NOT NULL,
  "locale" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "status" "PublicSitePageStatus" NOT NULL DEFAULT 'DRAFT',
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalPath" TEXT,
  "noIndex" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicSitePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicSiteSection" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "kind" "PublicSiteSectionKind" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PublicSiteSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicSitePage_site_locale_path_key"
ON "PublicSitePage"("site", "locale", "path");

CREATE INDEX "PublicSitePage_site_locale_status_idx"
ON "PublicSitePage"("site", "locale", "status");

CREATE INDEX "PublicSitePage_updatedAt_idx"
ON "PublicSitePage"("updatedAt");

CREATE UNIQUE INDEX "PublicSiteSection_pageId_key_key"
ON "PublicSiteSection"("pageId", "key");

CREATE INDEX "PublicSiteSection_pageId_enabled_sortOrder_idx"
ON "PublicSiteSection"("pageId", "enabled", "sortOrder");

ALTER TABLE "PublicSiteSection"
ADD CONSTRAINT "PublicSiteSection_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "PublicSitePage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
