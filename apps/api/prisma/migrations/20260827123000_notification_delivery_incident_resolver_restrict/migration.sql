ALTER TABLE "NotificationDeliveryIncident"
  DROP CONSTRAINT "NotificationDeliveryIncident_resolvedByAdminId_fkey";

ALTER TABLE "NotificationDeliveryIncident"
  ADD CONSTRAINT "NotificationDeliveryIncident_resolvedByAdminId_fkey"
  FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
