ALTER TABLE "PushDevice"
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "PushDevice_userId_role_enabled_idx" ON "PushDevice"("userId", "role", "enabled");
