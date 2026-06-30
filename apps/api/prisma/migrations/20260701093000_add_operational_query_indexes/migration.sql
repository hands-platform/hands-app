-- Add focused indexes for high-volume operational lists and detail lookups.
-- These support paginated Admin, mobile booking, notification, chat, and finance reads.

CREATE INDEX IF NOT EXISTS "ProviderProfile_status_currentLocationUpdatedAt_idx"
  ON "ProviderProfile"("status", "currentLocationUpdatedAt");
CREATE INDEX IF NOT EXISTS "ProviderProfile_blockedAt_deletedAt_idx"
  ON "ProviderProfile"("blockedAt", "deletedAt");

CREATE INDEX IF NOT EXISTS "Booking_customerProfileId_createdAt_idx"
  ON "Booking"("customerProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_preferredProviderId_createdAt_idx"
  ON "Booking"("preferredProviderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_selectedProviderId_createdAt_idx"
  ON "Booking"("selectedProviderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_idx"
  ON "Booking"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "BookingService_bookingId_idx"
  ON "BookingService"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingService_serviceId_idx"
  ON "BookingService"("serviceId");

CREATE INDEX IF NOT EXISTS "BookingParticipant_providerProfileId_joinedAt_idx"
  ON "BookingParticipant"("providerProfileId", "joinedAt");
CREATE INDEX IF NOT EXISTS "BookingParticipant_status_joinedAt_idx"
  ON "BookingParticipant"("status", "joinedAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_chatRoomId_createdAt_idx"
  ON "ChatMessage"("chatRoomId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_createdAt_idx"
  ON "ChatMessage"("senderId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProviderEarning_providerProfileId_createdAt_idx"
  ON "ProviderEarning"("providerProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProviderEarning_status_createdAt_idx"
  ON "ProviderEarning"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProviderEarning_payoutBatchId_idx"
  ON "ProviderEarning"("payoutBatchId");

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_notificationId_attemptedAt_idx"
  ON "NotificationDelivery"("notificationId", "attemptedAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_pushDeviceId_attemptedAt_idx"
  ON "NotificationDelivery"("pushDeviceId", "attemptedAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_provider_status_attemptedAt_idx"
  ON "NotificationDelivery"("provider", "status", "attemptedAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_attemptedAt_idx"
  ON "NotificationDelivery"("status", "attemptedAt");

CREATE INDEX IF NOT EXISTS "LocationSnapshot_providerProfileId_recordedAt_idx"
  ON "LocationSnapshot"("providerProfileId", "recordedAt");
CREATE INDEX IF NOT EXISTS "LocationSnapshot_bookingId_recordedAt_idx"
  ON "LocationSnapshot"("bookingId", "recordedAt");

CREATE INDEX IF NOT EXISTS "Coupon_active_startsAt_endsAt_idx"
  ON "Coupon"("active", "startsAt", "endsAt");
