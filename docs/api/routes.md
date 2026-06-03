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

Partner verification files must be private. Public partner gallery/profile images can later be served through CDN.

For `provider-verification` uploads, partners may omit `providerVerificationId`; the API resolves or creates the partner's verification record automatically.

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
- `POST /admin/partner-devices/:id/block`
- `POST /admin/partner-devices/:id/unblock`
- `POST /admin/partner-documents/:id/approve`
- `POST /admin/partner-documents/:id/reject`
- `POST /admin/partner-bank-accounts/:id/approve`
- `POST /admin/partner-bank-accounts/:id/reject`
- `GET /admin/partner-reports`
- `POST /admin/partner-reports`
- `PATCH /admin/partner-reports/:id`
- `GET /admin/partner-sanctions`
- `POST /admin/partners/:id/sanctions`
- `POST /admin/partner-sanctions/:id/lift`
- `GET /admin/bookings`
- `GET /admin/payments`
- `GET /admin/payment-callback-attempts`
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

Legacy `/admin/providers`, `/admin/provider-reports`, `/admin/provider-sanctions`, `/admin/provider-devices`, `/admin/provider-documents`, and `/admin/provider-bank-accounts` aliases are kept for compatibility while the admin product language moves to Partner.

## Payments

- `POST /payments/MOMO/callback`
- `POST /payments/VNPAY/callback`
- `POST /payments/CASH/callback`

MoMo and VNPay callbacks verify provider signatures when the relevant secret is configured.
Production rejects MoMo/VNPay callback processing if the required provider secret is missing.
Cash callbacks are internal/admin-operable MVP placeholders.

Manual admin refunds move the payment to `REFUNDED`, mark the booking as `REFUNDED`, create a `Refund` row, and cancel unpaid partner earnings for that booking.

## Phase 1 Booking And Open Marketplace Notes

- `POST /customer/bookings` can include an optional `providerId` for the first MVP direct-booking flow. The field name remains `providerId` for API compatibility, but product copy should say partner.
- When `providerId` is present, the booking is treated as a preferred first-pick partner request, but the booking still opens the Open Matching Marketplace.
- A direct first-pick request waits 10 minutes by default.
- Marketplace participants can join before the customer selects the final partner. Distance can rank requests and alert delivery, but it is not the source of final assignment.
- `GET /partner/bookings/open` returns:
  - direct requests targeted to the authenticated partner
  - open marketplace requests where the authenticated partner can participate
- `POST /partner/bookings/:id/accept` confirms a direct request.
- `POST /partner/bookings/:id/join` records a marketplace participant and stores the server-calculated distance snapshot.
- Negative-wallet partners can still see marketplace requests in `GET /partner/bookings/open`, but `POST /partner/bookings/:id/join` is blocked until settlement or admin offset. Blocked join attempts do not create participant records.
- Chat is created after the booking is matched. `POST /partner/bookings/:id/start` advances service lifecycle state.
