CREATE TYPE "NotificationTranslationStatus" AS ENUM (
  'SOURCE_COPIED',
  'NEEDS_TRANSLATION',
  'NEEDS_REVIEW',
  'READY'
);

ALTER TABLE "NotificationTemplateTranslation"
  ADD COLUMN "status" "NotificationTranslationStatus" NOT NULL DEFAULT 'NEEDS_TRANSLATION',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByAdminId" TEXT;

UPDATE "NotificationTemplateTranslation" AS translation
SET "status" = CASE
  WHEN BTRIM(translation."title") = '' OR BTRIM(translation."body") = ''
    THEN 'NEEDS_TRANSLATION'::"NotificationTranslationStatus"
  WHEN translation."locale" = 'en'
    THEN 'NEEDS_REVIEW'::"NotificationTranslationStatus"
  WHEN EXISTS (
    SELECT 1
    FROM "NotificationTemplateTranslation" AS source
    WHERE source."templateId" = translation."templateId"
      AND source."locale" = 'en'
      AND source."title" = translation."title"
      AND source."body" = translation."body"
  )
    THEN 'SOURCE_COPIED'::"NotificationTranslationStatus"
  ELSE 'NEEDS_REVIEW'::"NotificationTranslationStatus"
END;

CREATE INDEX "NotificationTemplateTranslation_status_idx"
  ON "NotificationTemplateTranslation"("status");

WITH definitions("key", "audience", "channel", "description", "variables", "title", "body") AS (
  VALUES
  ('booking.opened', 'CUSTOMER', 'BOTH', 'Customer confirmation after a booking request is created.', '[]'::jsonb, 'Booking opened', 'We are looking for nearby partners.'),
  ('booking.requested', 'PROVIDER', 'BOTH', 'Direct first-pick booking request sent to a Partner.', '[]'::jsonb, 'New direct booking request', 'A customer requested one of your services.'),
  ('booking.backup_available', 'PROVIDER', 'BOTH', 'Marketplace/open request available to eligible nearby Partners.', '[]'::jsonb, 'Nearby booking available', 'A nearby customer request is open for marketplace participation.'),
  ('provider.joined', 'CUSTOMER', 'BOTH', 'Customer notice when a Partner joins a booking request.', '["partnerName"]'::jsonb, 'A partner joined', '{partnerName} joined your booking.'),
  ('booking.matched', 'CUSTOMER', 'BOTH', 'Customer notice when a Partner is matched and chat is ready.', '[]'::jsonb, 'Partner matched', 'Your chat room is ready.'),
  ('booking.matched.partner', 'PROVIDER', 'BOTH', 'Partner notice after being selected or first-pick matched.', '[]'::jsonb, 'You were matched', 'The customer selected you for this booking.'),
  ('booking.rejected', 'CUSTOMER', 'BOTH', 'Customer notice when a requested Partner cannot accept.', '[]'::jsonb, 'Partner declined your booking', 'We are still looking for another available partner.'),
  ('provider.accepted', 'CUSTOMER', 'BOTH', 'Customer notice that a marketplace Partner is ready.', '["partnerName"]'::jsonb, 'Marketplace partner is ready', '{partnerName} can take this booking. Select this partner if you want to switch.'),
  ('provider.rejected', 'CUSTOMER', 'BOTH', 'Customer notice that a marketplace Partner declined.', '["partnerName"]'::jsonb, 'Partner declined', '{partnerName} cannot take this booking.'),
  ('service.started', 'CUSTOMER', 'BOTH', 'Customer notice when the Partner starts service.', '[]'::jsonb, 'Service started', 'Your partner started the service. Continue in the matched chat if needed.'),
  ('service.started.partner', 'PROVIDER', 'BOTH', 'Partner notice when service starts.', '[]'::jsonb, 'Service started', 'Continue with the customer in the matched chat if needed.'),
  ('service.completed', 'CUSTOMER', 'BOTH', 'Customer notice after service completion.', '[]'::jsonb, 'Service completed', 'Please leave a review when you are ready.'),
  ('earning.created', 'PROVIDER', 'BOTH', 'Partner notice when completed work is added to earnings.', '[]'::jsonb, 'Earning created', 'Your completed service has been added to earnings.'),
  ('payment.updated', 'CUSTOMER', 'BOTH', 'Customer notice for payment status changes.', '[]'::jsonb, 'Payment updated', 'Your booking payment status was updated.'),
  ('chat.message', 'CUSTOMER', 'BOTH', 'Customer alert when a Partner sends a booking chat message.', '[]'::jsonb, 'New chat message', 'A new message is available in your booking chat.'),
  ('chat.message.partner', 'PROVIDER', 'BOTH', 'Partner alert when a Customer sends a booking chat message.', '[]'::jsonb, 'New chat message', 'A new message is available in your booking chat.'),
  ('booking.cancelled', 'CUSTOMER', 'BOTH', 'Customer booking cancellation notice.', '[]'::jsonb, 'Booking cancelled', 'Your request has been cancelled.'),
  ('booking.cancelled.partner', 'PROVIDER', 'BOTH', 'Partner notice when a booking request closes before commitment.', '[]'::jsonb, 'Booking cancelled', 'This booking request is no longer available.'),
  ('booking.no_show', 'CUSTOMER', 'BOTH', 'Customer no-show review notice.', '[]'::jsonb, 'No-show under review', 'HANDS operations marked this booking as no-show. Payment and support review is pending.'),
  ('booking.no_show.partner', 'PROVIDER', 'BOTH', 'Partner no-show review notice.', '[]'::jsonb, 'Booking marked no-show', 'HANDS operations marked this booking as no-show. Check the booking note before fee or payout follow-up.'),
  ('provider.account.blocked', 'PROVIDER', 'BOTH', 'Partner account blocked notice.', '[]'::jsonb, 'Partner account blocked', 'Your HANDS partner account is under admin review. Open the app for details.'),
  ('provider.account.unblocked', 'PROVIDER', 'BOTH', 'Partner account unblocked notice.', '[]'::jsonb, 'Partner account unblocked', 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.'),
  ('provider.payout_setup_required', 'PROVIDER', 'BOTH', 'Partner payout setup notice after first earning.', '[]'::jsonb, 'Payout setup required', 'Your first HANDS earning is recorded. Add payout setup before requesting payout.'),
  ('provider.payout_batch.updated', 'PROVIDER', 'BOTH', 'Partner payout batch status update.', '[]'::jsonb, 'Payout batch updated', 'Your payout batch needs follow-up. Check the payout screen for details.')
)
INSERT INTO "NotificationTemplate" (
  "id", "key", "audience", "channel", "description", "variables", "enabled", "createdAt", "updatedAt"
)
SELECT
  'managed-notification-template-' || REPLACE(definitions."key", '.', '-'),
  definitions."key",
  definitions."audience"::"Role",
  definitions."channel",
  definitions."description",
  definitions."variables",
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM definitions
ON CONFLICT ("key") DO NOTHING;

WITH definitions("key", "title", "body") AS (
  VALUES
  ('booking.opened', 'Booking opened', 'We are looking for nearby partners.'),
  ('booking.requested', 'New direct booking request', 'A customer requested one of your services.'),
  ('booking.backup_available', 'Nearby booking available', 'A nearby customer request is open for marketplace participation.'),
  ('provider.joined', 'A partner joined', '{partnerName} joined your booking.'),
  ('booking.matched', 'Partner matched', 'Your chat room is ready.'),
  ('booking.matched.partner', 'You were matched', 'The customer selected you for this booking.'),
  ('booking.rejected', 'Partner declined your booking', 'We are still looking for another available partner.'),
  ('provider.accepted', 'Marketplace partner is ready', '{partnerName} can take this booking. Select this partner if you want to switch.'),
  ('provider.rejected', 'Partner declined', '{partnerName} cannot take this booking.'),
  ('service.started', 'Service started', 'Your partner started the service. Continue in the matched chat if needed.'),
  ('service.started.partner', 'Service started', 'Continue with the customer in the matched chat if needed.'),
  ('service.completed', 'Service completed', 'Please leave a review when you are ready.'),
  ('earning.created', 'Earning created', 'Your completed service has been added to earnings.'),
  ('payment.updated', 'Payment updated', 'Your booking payment status was updated.'),
  ('chat.message', 'New chat message', 'A new message is available in your booking chat.'),
  ('chat.message.partner', 'New chat message', 'A new message is available in your booking chat.'),
  ('booking.cancelled', 'Booking cancelled', 'Your request has been cancelled.'),
  ('booking.cancelled.partner', 'Booking cancelled', 'This booking request is no longer available.'),
  ('booking.no_show', 'No-show under review', 'HANDS operations marked this booking as no-show. Payment and support review is pending.'),
  ('booking.no_show.partner', 'Booking marked no-show', 'HANDS operations marked this booking as no-show. Check the booking note before fee or payout follow-up.'),
  ('provider.account.blocked', 'Partner account blocked', 'Your HANDS partner account is under admin review. Open the app for details.'),
  ('provider.account.unblocked', 'Partner account unblocked', 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.'),
  ('provider.payout_setup_required', 'Payout setup required', 'Your first HANDS earning is recorded. Add payout setup before requesting payout.'),
  ('provider.payout_batch.updated', 'Payout batch updated', 'Your payout batch needs follow-up. Check the payout screen for details.')
), inserted_translations AS (
INSERT INTO "NotificationTemplateTranslation" (
  "id", "templateId", "locale", "title", "body", "status", "createdAt", "updatedAt"
)
SELECT
  'managed-notification-translation-' || REPLACE(definitions."key", '.', '-') || '-' || locale."value",
  template."id",
  locale."value",
  definitions."title",
  definitions."body",
  CASE WHEN locale."value" = 'en'
    THEN 'READY'::"NotificationTranslationStatus"
    ELSE 'SOURCE_COPIED'::"NotificationTranslationStatus"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM definitions
JOIN "NotificationTemplate" AS template ON template."key" = definitions."key"
CROSS JOIN (VALUES ('en'), ('vi'), ('ko'), ('ja'), ('zh')) AS locale("value")
ON CONFLICT ("templateId", "locale") DO NOTHING
RETURNING "id"
)
UPDATE "NotificationTemplateTranslation" AS translation
SET "status" = CASE
  WHEN BTRIM(translation."title") = '' OR BTRIM(translation."body") = ''
    THEN 'NEEDS_TRANSLATION'::"NotificationTranslationStatus"
  WHEN translation."title" = definitions."title" AND translation."body" = definitions."body"
    THEN 'READY'::"NotificationTranslationStatus"
  ELSE 'NEEDS_REVIEW'::"NotificationTranslationStatus"
END
FROM definitions
JOIN "NotificationTemplate" AS template ON template."key" = definitions."key"
WHERE translation."templateId" = template."id"
  AND translation."locale" = 'en';

UPDATE "NotificationTemplate"
SET "enabled" = FALSE
WHERE "key" = 'admin.push.broadcast';
