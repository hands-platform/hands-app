# Notifications

## Current MVP

The API creates persistent `Notification` rows for booking lifecycle and operations events before any OS push attempt. Each notification schedules a `notification-retry` BullMQ job. The worker records one `NotificationDelivery` attempt per enabled `PushDevice`.

HANDS uses Firebase Cloud Messaging for Android/iOS push notifications only. Firebase Realtime Database, Firestore, and Firebase Auth are not part of the MVP architecture.

Socket.IO remains the realtime channel while the app is open. FCM is only for background, killed-app, and OS-level notification delivery.

## Device Tokens

Apps register FCM tokens through authenticated API routes:

```http
PATCH /api/notifications/device-token/register
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "token": "fcm-device-token",
  "platform": "android"
}
```

`POST /api/notifications/device-token/register` is kept as an equivalent compatibility route. `DELETE /api/notifications/device-token` disables a token for the authenticated user. A user can only register or disable their own token because the API always takes `userId` and role from the access token.

`platform` accepts `android` or `ios` only. Web push is not part of the HANDS MVP push surface.

`PushDevice` stores the user, actor role, platform, token, enabled state, last seen time, and created/updated timestamps. Admin views must never expose raw token values.

## Delivery Adapter

Local development should keep:

```dotenv
PUSH_PROVIDER=in_app_only
```

This records skipped delivery attempts and keeps the in-app inbox/audit path visible without requiring Firebase credentials.

Staging or production OS push should be enabled explicitly:

```dotenv
PUSH_PROVIDER=fcm
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
# or
FIREBASE_SERVICE_ACCOUNT_JSON=
# optional local ADC path
GOOGLE_APPLICATION_CREDENTIALS=
```

Firebase Admin credentials are server-side only. Never send service account JSON, private keys, APNs keys, or Admin SDK credentials to Flutter, Admin Web, browser JavaScript, or Git.

When FCM credentials are absent, `PushDeliveryService` fails safely by recording a failed `NotificationDelivery`; the API process and booking/matching flows must not crash. OS push data is filtered to routing identifiers such as `bookingId`, `chatRoomId`, and profile or payment record ids, and the backend always adds the stored `notificationId` for open/read tracking. Do not place sensitive customer address details, operator notes, or free-form reasons in push bodies or FCM data payloads.

For a narrow Docker/API push check after credentials are configured, use:

```powershell
$env:API_BASE_URL='http://localhost:3000/api'
$env:FCM_SMOKE_DEVICE_TOKEN='<real app FCM token>'
$env:FCM_SMOKE_EXPECT_PROVIDER='FCM'
$env:FCM_SMOKE_EXPECT_STATUS='SENT'
npm.cmd run fcm:push-smoke
```

The smoke also accepts `-- --env=.env` and merges that file with the current shell environment, so local-only values like `API_BASE_URL` and `FCM_SMOKE_DEVICE_TOKEN` can live outside the command line. Shell variables still win over file values.

The smoke registers the device token for a demo customer/provider, retries an existing notification, and verifies that a new delivery record is created. It never prints the raw FCM token. If the selected user has no notification yet, run a booking/chat flow first or set `FCM_SMOKE_NOTIFICATION_ID` to a known notification.

## Mobile Setup Notes

Android uses `google-services.json` and the Google Services Gradle plugin when FCM client integration is added. iOS uses `GoogleService-Info.plist`, APNs key/cert configuration through Firebase, and the Flutter FCM client. These files are secrets/config artifacts and must stay outside Git.

Mobile code must not replace Socket.IO booking/chat realtime behavior. Register the FCM token after login, refresh it when FCM rotates the token, and send it to the NestJS API.

## Notification Event Boundaries

Current call sites stay at service boundaries:

- first-pick request to a partner
- open request available to eligible marketplace partners
- partner joined booking request
- customer final selection / booking matched
- chat message notification
- booking cancelled
- booking completed
- payment status notification
- payout setup notification
- payout batch status notification

If a flow is not ready, add the TODO at the relevant service boundary instead of scattering push-specific logic across booking, matching, payment, or chat code.
