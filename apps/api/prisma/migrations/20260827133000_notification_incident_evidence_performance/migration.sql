-- Preserve latest-per-device ordering without an incremental sort when the
-- notification delivery incident evidence query scans historical attempts.
CREATE INDEX "NotificationDelivery_latest_per_device_idx"
ON "NotificationDelivery" ("notificationId", "pushDeviceId", "attemptedAt" DESC, "id" DESC);

-- PostgreSQL cannot estimate these JSON expressions through Prisma's schema
-- model. Expression and multivariate statistics keep the set-based plan from
-- regressing to one Notification primary-key lookup per matching delivery.
CREATE STATISTICS "NotificationDelivery_provider_status_failure_stats" (mcv, dependencies)
ON
  "provider",
  "status",
  (COALESCE(
    NULLIF("response"->>'failureCode', ''),
    NULLIF("response"->'body'->'error'->>'status', ''),
    'UNCLASSIFIED_FAILURE'
  ))
FROM "NotificationDelivery";

CREATE STATISTICS "Notification_data_scope_stats" (mcv, dependencies)
ON
  (LOWER(COALESCE("data"->>'dataScope', ''))),
  (LOWER(COALESCE("data"->>'smokeFixture', 'false'))),
  (LOWER(COALESCE("data"->>'smoke', 'false'))),
  (LOWER(COALESCE("data"->>'fixture', 'false')))
FROM "Notification";

ANALYZE "NotificationDelivery";
ANALYZE "Notification";
