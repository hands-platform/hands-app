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
- `GET /customer/providers/nearby`
- `GET /customer/providers/:id`
- `POST /customer/bookings`
- `GET /customer/bookings/:id`
- `POST /customer/bookings/:id/cancel`
- `POST /customer/bookings/:id/select-provider`
- `POST /customer/reviews`

## Provider

- `GET /provider/me`
- `PATCH /provider/me`
- `POST /provider/online`
- `POST /provider/offline`
- `POST /provider/location`
- `GET /provider/verification`
- `POST /provider/verification/submit`
- `GET /provider/bookings/open`
- `POST /provider/bookings/:id/join`
- `POST /provider/bookings/:id/accept`
- `POST /provider/bookings/:id/reject`
- `POST /provider/bookings/:id/arrived`
- `POST /provider/bookings/:id/start`
- `POST /provider/bookings/:id/complete`
- `GET /provider/earnings`
- `GET /provider/earnings/summary`
- `GET /provider/earnings/payout-batches`

## Chat

- `GET /chat/rooms/:id/messages`
- `POST /chat/rooms/:id/messages`

Chat access is limited to the booking customer, the selected provider, and admins.

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
- `GET /admin/providers`
- `POST /admin/providers/:id/approve`
- `POST /admin/providers/:id/reject`
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
- `GET /provider/bookings/open` returns:
  - direct requests targeted to the authenticated provider
  - open requests within 10km where the authenticated partner can join as backup
- `POST /provider/bookings/:id/accept` confirms a direct request.
- `POST /provider/bookings/:id/join` records a backup participant and stores the server-calculated distance snapshot.
- `POST /provider/bookings/:id/start` creates the chat room when the provider starts the service flow.
