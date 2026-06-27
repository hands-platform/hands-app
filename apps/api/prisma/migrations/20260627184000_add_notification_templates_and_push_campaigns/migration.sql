-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "audience" "Role" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'BOTH',
    "description" TEXT,
    "variables" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplateTranslation" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplateTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPushCampaign" (
    "id" TEXT NOT NULL,
    "targetRole" "Role" NOT NULL,
    "targetUserId" TEXT,
    "locale" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AdminPushCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPushCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPushCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");

-- CreateIndex
CREATE INDEX "NotificationTemplate_audience_enabled_idx" ON "NotificationTemplate"("audience", "enabled");

-- CreateIndex
CREATE INDEX "NotificationTemplate_channel_idx" ON "NotificationTemplate"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplateTranslation_templateId_locale_key" ON "NotificationTemplateTranslation"("templateId", "locale");

-- CreateIndex
CREATE INDEX "NotificationTemplateTranslation_locale_idx" ON "NotificationTemplateTranslation"("locale");

-- CreateIndex
CREATE INDEX "AdminPushCampaign_targetRole_createdAt_idx" ON "AdminPushCampaign"("targetRole", "createdAt");

-- CreateIndex
CREATE INDEX "AdminPushCampaign_targetUserId_idx" ON "AdminPushCampaign"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminPushCampaign_createdById_createdAt_idx" ON "AdminPushCampaign"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPushCampaignRecipient_campaignId_userId_key" ON "AdminPushCampaignRecipient"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "AdminPushCampaignRecipient_userId_createdAt_idx" ON "AdminPushCampaignRecipient"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminPushCampaignRecipient_notificationId_idx" ON "AdminPushCampaignRecipient"("notificationId");

-- AddForeignKey
ALTER TABLE "NotificationTemplateTranslation" ADD CONSTRAINT "NotificationTemplateTranslation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPushCampaignRecipient" ADD CONSTRAINT "AdminPushCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdminPushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
