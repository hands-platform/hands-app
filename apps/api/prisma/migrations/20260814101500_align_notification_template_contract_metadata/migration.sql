-- Keep persisted display metadata aligned with the canonical runtime catalog.
-- Translation copy, readiness, enabled state, and audit history are intentionally untouched.
WITH definitions("key", "audience", "channel", "description", "variables") AS (
  VALUES
  ('booking.opened', 'CUSTOMER', 'BOTH', 'Customer confirmation after a booking request is created.', '[]'::jsonb),
  ('booking.requested', 'PROVIDER', 'BOTH', 'Direct first-pick booking request sent to a Partner.', '[]'::jsonb),
  ('booking.backup_available', 'PROVIDER', 'BOTH', 'Marketplace/open request available to eligible nearby Partners.', '[]'::jsonb),
  ('provider.joined', 'CUSTOMER', 'BOTH', 'Customer notice when a Partner joins a booking request.', '["partnerName"]'::jsonb),
  ('booking.matched', 'CUSTOMER', 'BOTH', 'Customer notice when a Partner is matched and chat is ready.', '[]'::jsonb),
  ('booking.matched.partner', 'PROVIDER', 'BOTH', 'Partner notice after being selected or first-pick matched.', '[]'::jsonb),
  ('booking.rejected', 'CUSTOMER', 'BOTH', 'Customer notice when a requested Partner cannot accept.', '[]'::jsonb),
  ('provider.accepted', 'CUSTOMER', 'BOTH', 'Customer notice that a marketplace Partner is ready.', '["partnerName"]'::jsonb),
  ('provider.rejected', 'CUSTOMER', 'BOTH', 'Customer notice that a marketplace Partner declined.', '["partnerName"]'::jsonb),
  ('service.started', 'CUSTOMER', 'BOTH', 'Customer notice when the Partner starts service.', '[]'::jsonb),
  ('service.started.partner', 'PROVIDER', 'BOTH', 'Partner notice when service starts.', '[]'::jsonb),
  ('service.completed', 'CUSTOMER', 'BOTH', 'Customer notice after service completion.', '[]'::jsonb),
  ('earning.created', 'PROVIDER', 'BOTH', 'Partner notice when completed work is added to earnings.', '[]'::jsonb),
  ('payment.updated', 'CUSTOMER', 'BOTH', 'Customer notice for payment status changes.', '[]'::jsonb),
  ('chat.message', 'CUSTOMER', 'BOTH', 'Customer alert when a Partner sends a booking chat message.', '[]'::jsonb),
  ('chat.message.partner', 'PROVIDER', 'BOTH', 'Partner alert when a Customer sends a booking chat message.', '[]'::jsonb),
  ('booking.cancelled', 'CUSTOMER', 'BOTH', 'Customer booking cancellation notice.', '[]'::jsonb),
  ('booking.cancelled.partner', 'PROVIDER', 'BOTH', 'Partner notice when a booking request closes before commitment.', '[]'::jsonb),
  ('booking.no_show', 'CUSTOMER', 'BOTH', 'Customer no-show review notice.', '[]'::jsonb),
  ('booking.no_show.partner', 'PROVIDER', 'BOTH', 'Partner no-show review notice.', '[]'::jsonb),
  ('provider.account.blocked', 'PROVIDER', 'BOTH', 'Partner account blocked notice.', '[]'::jsonb),
  ('provider.account.unblocked', 'PROVIDER', 'BOTH', 'Partner account unblocked notice.', '[]'::jsonb),
  ('provider.payout_setup_required', 'PROVIDER', 'BOTH', 'Partner payout setup notice after first earning.', '[]'::jsonb),
  ('provider.payout_batch.updated', 'PROVIDER', 'BOTH', 'Partner payout batch status update.', '[]'::jsonb)
)
UPDATE "NotificationTemplate" AS template
SET
  "audience" = definitions."audience"::"Role",
  "channel" = definitions."channel",
  "description" = definitions."description",
  "variables" = definitions."variables",
  "updatedAt" = CURRENT_TIMESTAMP
FROM definitions
WHERE template."key" = definitions."key"
  AND (
    template."audience" IS DISTINCT FROM definitions."audience"::"Role"
    OR template."channel" IS DISTINCT FROM definitions."channel"
    OR template."description" IS DISTINCT FROM definitions."description"
    OR template."variables" IS DISTINCT FROM definitions."variables"
  );
