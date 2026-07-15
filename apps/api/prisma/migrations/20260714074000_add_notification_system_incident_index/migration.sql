-- Prisma 6 cannot represent partial-index predicates in schema.prisma.
-- Keep this migration and its contract test as the source for this bounded incident index.
CREATE INDEX "Notification_systemIncident_createdAt_idx"
ON "Notification"("createdAt")
WHERE "type" LIKE 'admin.system.%';
