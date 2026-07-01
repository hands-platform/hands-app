ALTER TYPE "Role" ADD VALUE 'MASTER_ADMIN';

CREATE TYPE "AdminOperatorPermissionCategory" AS ENUM (
  'BOOKINGS',
  'CUSTOMERS',
  'PARTNERS',
  'FINANCE',
  'NOTIFICATIONS',
  'SYSTEM'
);

CREATE TABLE "AdminOperatorPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categories" "AdminOperatorPermissionCategory"[] DEFAULT ARRAY[]::"AdminOperatorPermissionCategory"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminOperatorPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOperatorPermission_userId_key" ON "AdminOperatorPermission"("userId");
CREATE INDEX "AdminOperatorPermission_updatedAt_idx" ON "AdminOperatorPermission"("updatedAt");

ALTER TABLE "AdminOperatorPermission"
  ADD CONSTRAINT "AdminOperatorPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
