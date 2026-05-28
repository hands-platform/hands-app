# API Route Plan

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

Local MVP auth uses `POST /auth/verify-otp` with dev OTP `123456`.

## Auth

- `GET /health`
- `GET /health/ready`
- `GET /health/external`
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `POST /auth/refresh`

## Customer

- `GET /customer/me`
- `PATCH /customer/me`
- `GET /customer/partners/nearby`
- `GET /customer/partners/:id`
- `POST /customer/bookings`
- `GET /customer/bookings/:id`
- `POST /customer/bookings/:id/cancel`
- `POST /customer/bookings/:id/select-provider`
- `POST /customer/reviews`

Legacy customer aliases `/customer/providers/nearby` and `/customer/providers/:id` remain active for older app builds.

## Partner

- `GET /partner/me`
- `PATCH /partner/me`
- `PATCH /partner/me/profile`
- `POST /partner/online`
- `POST /partner/offline`
- `POST /partner/location`
- `POST /partner/device-session`
- `GET /partner/services`
- `GET /partner/services/groups`
- `PATCH /partner/services/:serviceId`
- `GET /partner/verification`
- `POST /partner/verification/submit`
- `GET /partner/onboarding`
- `PATCH /partner/onboarding/basic-profile`
- `POST /partner/onboarding/kyc/submit`
- `POST /partner/onboarding/bank-accounts`
- `POST /partner/onboarding/tax-profile`
- `POST /partner/onboarding/agreements`
- `GET /partner/bookings/open`
- `GET /partner/bookings`
- `POST /partner/bookings/:id/join`
- `POST /partner/bookings/:id/accept`
- `POST /partner/bookings/:id/reject`
- `POST /partner/bookings/:id/arrived`
- `POST /partner/bookings/:id/start`
- `POST /partner/bookings/:id/complete`
- `GET /partner/earnings`
- `GET /partner/earnings/summary`
- `GET /partner/earnings/payout-batches`

Legacy `/provider/*` routes remain active for compatibility while mobile code migrates to partner naming.

## Chat

- `GET /chat/rooms/:id/messages`
- `POST /chat/rooms/:id/messages`

Chat access is limited to the booking customer, the selected partner, and admins.

## Files

- `POST /files/presign`
- `GET /files/:id/read-url`

Provider verification files must be private. Public provider gallery/profile images can later be served through CDN.

For `provider-verification` uploads, providers may omit `providerVerificationId`; the API resolves or creates the provider's verification record automatically.

## Notifications

- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/device-token/register`
- `POST /notifications/device-token/register`

The retry queue stores DB notifications first. Delivery attempts are recorded in `NotificationDelivery`. The current adapter is `IN_APP_ONLY`; when a future OS push provider is enabled, permanent provider token failures should disable the affected `PushDevice` until the app registers a fresh token again.

## Admin

- `GET /admin/users`
- `GET /admin/partners`
- `GET /admin/partners/:id`
- `POST /admin/partners/:id/approve`
- `POST /admin/partners/:id/reject`
- `POST /admin/partners/:id/block`
- `POST /admin/partners/:id/unblock`
- `POST /admin/partners/:id/sync-supabase-role`
- `GET /admin/partner-reports`
- `POST /admin/partner-reports`
- `PATCH /admin/partner-reports/:id`
- `GET /admin/partner-sanctions`
- `POST /admin/partners/:id/sanctions`
- `POST /admin/partner-sanctions/:id/lift`
- `GET /admin/bookings`
- `GET /admin/payments`
- `POST /admin/payments/:id/refund`
- `GET /admin/refunds`
- `GET /admin/earnings`
- `GET /admin/earnings/summary`
- `POST /admin/earnings/:id/mark-paid`
- `GET /admin/payout-batches`
- `POST /admin/payout-batches`
- `GET /admin/reviews`
- `PATCH /admin/reviews/:id/moderate`
- `GET /admin/notifications`

Legacy `/admin/providers`, `/admin/provider-reports`, and `/admin/provider-sanctions` aliases are kept for compatibility while the admin product language moves to Partner.

## Payments

- `POST /payments/MOMO/callback`
- `POST /payments/VNPAY/callback`
- `POST /payments/CASH/callback`

Callbacks are placeholder parser routes in the MVP. Real MoMo/VNPay signature validation must be added before production.

Manual admin refunds move the payment to `REFUNDED`, mark the booking as `REFUNDED`, create a `Refund` row, and cancel unpaid provider earnings for that booking.

## Phase 1 Direct Booking Notes

- `POST /customer/bookings` can include an optional `providerId` for the first MVP direct-booking flow.
- When `providerId` is present, the booking is treated as a direct first-pick request, but the matching window still stays open for nearby backup partners.
- A direct first-pick request waits 10 minutes by default.
- Online partners within 10km of the booking location receive `booking.backup_available` notifications and can join before the customer selects the final partner.
- `GET /partner/bookings/open` returns:
  - direct requests targeted to the authenticated provider
  - open requests within 10km where the authenticated partner can join as backup
- `POST /partner/bookings/:id/accept` confirms a direct request.
- `POST /partner/bookings/:id/join` records a backup participant and stores the server-calculated distance snapshot.
- `POST /partner/bookings/:id/start` creates the chat room when the partner starts the service flow.
