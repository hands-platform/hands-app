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

`GET /customer/partners/nearby` accepts optional `lat` and `lng` query parameters for distance sorting. If the customer is outside Vietnam, has denied GPS, or sends no coordinates, the API falls back to the default Vietnam service-area browse pin so customers can still view partner supply from any country. Booking creation remains stricter: `POST /customer/bookings` requires a confirmed service address inside the active HANDS service area, stores it as `BookingAddressSnapshot`, and rejects fresh current GPS that is 50km or more away from the selected service address.

`POST /customer/bookings/:id/cancel` is only a pre-commitment customer action. Once a partner has accepted, been selected, or the booking is matched/on the way/arrived/in service, direct customer cancellation is blocked and the booking must be reviewed through retained chat evidence by HANDS operations.

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
- `POST /partner/bookings/:id/arrived` (legacy client compatibility only)
- `POST /partner/bookings/:id/start` (legacy client compatibility only)
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
- `DELETE /notifications/device-token`

The retry queue stores DB notifications first. Delivery attempts are recorded in `NotificationDelivery`. Local development may use `IN_APP_ONLY`; staging/production FCM push uses the backend Firebase Admin SDK. Permanent FCM token failures disable the affected `PushDevice` until the app registers a fresh token again.

Device token registration accepts `platform: "android"` or `platform: "ios"` only. FCM data payloads are filtered to routing identifiers and always include the stored `notificationId` plus the stored notification `type` for client routing; full notification details stay in the authenticated in-app notification record.

## Mobile Foundation

- `GET /mobile/app-version?appType=CUSTOMER&platform=ANDROID`
- `GET /mobile/app-version?appType=PARTNER&platform=IOS`
- `POST /mobile/devices/register`
- `DELETE /mobile/devices`

`POST /mobile/devices/register` is the platform-neutral device registration route for future customer and Partner mobile builds. It requires a customer or Partner JWT and accepts `platform: "ANDROID"`, `"IOS"`, or `"WEB"`, plus optional `appVersion`, `osVersion`, `deviceModel`, `locale`, and `timezone`. The API stores FCM as the push provider and still derives the owning user and actor role from the authenticated token, not from request body fields.

`DELETE /mobile/devices` disables the authenticated user's matching token without deleting notification delivery history. Clients should call it on logout or when FCM reports token rotation.

`GET /mobile/app-version` returns per-app/per-platform force-update policy. Missing inactive policy rows fall back to `forceUpdate: false`, so Android MVP builds are not blocked before operations configures rows.

## Admin

- `GET /admin/users`
- `GET /admin/partners` - compact operations list by default; use `/admin/partners/:id` for full partner detail.
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
- `GET /admin/payments/:id`
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

MoMo and VNPay callbacks verify gateway signatures when the relevant secret is configured.
Production rejects MoMo/VNPay callback processing if the required gateway secret is missing.
Cash callbacks are internal/admin-operable MVP placeholders.

Manual admin refunds move the payment to `REFUNDED`, mark the booking as `REFUNDED`, create a `Refund` row, and cancel unpaid partner earnings for that booking.

## Phase 1 Booking And Open Marketplace Notes

- `POST /customer/bookings` can include an optional `providerId` for the first MVP direct-booking flow. The field name remains `providerId` for API compatibility, but product copy should say partner.
- When `providerId` is present, the booking is treated as a preferred first-pick partner request, but the booking still opens the Open Matching Marketplace.
- A direct first-pick request waits 10 minutes by default.
- Marketplace participants can participate before the customer selects the final partner. Distance can rank requests and alert delivery, but it is not the source of final assignment.
- `GET /partner/bookings/open` returns:
  - direct requests targeted to the authenticated partner
  - open marketplace requests where the authenticated partner can participate
- `POST /partner/bookings/:id/accept` confirms a direct request.
- `POST /partner/bookings/:id/join` records a marketplace participant and stores the server-calculated distance snapshot.
- Negative-wallet partners can still see marketplace requests in `GET /partner/bookings/open`, but `POST /partner/bookings/:id/join` is blocked until settlement or admin offset. Blocked participation attempts do not create participant records.
- Final matching creates the chat room and immediately moves the booking to `IN_SERVICE`. Current partner clients do not require separate travel, arrival, or service-start actions.
- Customer direct cancellation is not available after partner commitment. Cancellation and no-show outcomes after matching are HANDS operations decisions based on chat, location, payment, and booking evidence.
