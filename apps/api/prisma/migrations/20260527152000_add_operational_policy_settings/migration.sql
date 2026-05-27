-- CreateTable
CREATE TABLE "OperationalPolicySetting" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "recommendedValue" JSONB,
    "options" JSONB,
    "requiresRestart" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalPolicySetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "OperationalPolicySetting_category_idx" ON "OperationalPolicySetting"("category");

-- CreateIndex
CREATE INDEX "OperationalPolicySetting_updatedAt_idx" ON "OperationalPolicySetting"("updatedAt");

-- AddForeignKey
ALTER TABLE "OperationalPolicySetting" ADD CONSTRAINT "OperationalPolicySetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
