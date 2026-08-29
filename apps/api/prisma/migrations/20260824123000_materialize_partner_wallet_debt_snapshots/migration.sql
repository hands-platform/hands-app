-- A wallet-debt cursor must retain the exact searchable Partner membership and
-- visible profile identity that existed when its first page was created.
-- These rows are bounded operational snapshots, not permanent profile audit history.
CREATE TABLE "PartnerWalletDebtSnapshot" (
  "id" TEXT NOT NULL,
  "filterHash" TEXT NOT NULL,
  "snapshotAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerWalletDebtSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerWalletDebtSnapshot_totalCount_check" CHECK ("totalCount" >= 0),
  CONSTRAINT "PartnerWalletDebtSnapshot_expiry_check" CHECK ("expiresAt" > "snapshotAt")
);

CREATE TABLE "PartnerWalletDebtSnapshotMember" (
  "snapshotId" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "balance" BIGINT NOT NULL,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "activityNickname" TEXT,
  "city" TEXT,
  "userFullName" TEXT,
  "userPhone" TEXT NOT NULL,
  "userEmail" TEXT,

  CONSTRAINT "PartnerWalletDebtSnapshotMember_pkey" PRIMARY KEY ("snapshotId", "providerProfileId"),
  CONSTRAINT "PartnerWalletDebtSnapshotMember_negative_balance_check" CHECK ("balance" < 0),
  CONSTRAINT "PartnerWalletDebtSnapshotMember_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "PartnerWalletDebtSnapshot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PartnerWalletDebtSnapshot_expiresAt_idx"
ON "PartnerWalletDebtSnapshot"("expiresAt");

CREATE INDEX "PartnerWalletDebtSnapshotMember_snapshotId_balance_providerProfileId_idx"
ON "PartnerWalletDebtSnapshotMember"("snapshotId", "balance", "providerProfileId");

-- providerProfileId deliberately has no live ProviderProfile FK: deleting or
-- renaming a live profile must not rewrite membership in an unexpired snapshot.
