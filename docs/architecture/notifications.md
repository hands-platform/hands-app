# Notifications

## Current MVP

The API creates persistent `Notification` rows for booking lifecycle and operations events before any FCM push attempt. Each notification schedules a `notification-retry` BullMQ job. The worker records one `NotificationDelivery` attempt per enabled `PushDevice`.

HANDS uses Firebase Cloud Messaging for Android/iOS FCM push notifications only. Firebase Realtime Database, Firestore, and Firebase Auth are not part of the MVP architecture.

Socket.IO remains the realtime channel while the app is open. FCM is only for background, killed-app, and Android/iOS notification delivery.

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

New notification rows should include internal `data.targetRole` metadata (`CUSTOMER` or `PROVIDER`) whenever the recipient surface is known. The retry worker uses that metadata to send push only to enabled devices registered for the matching app role. For older rows without that metadata, the worker may infer a target role only for unambiguous notification types. `targetRole` is an internal routing hint and must stay out of FCM data payloads.

## Delivery Adapter

Local development should keep:

```dotenv
PUSH_PROVIDER=in_app_only
```

This records skipped delivery attempts and keeps the in-app inbox/audit path visible without requiring Firebase credentials.

Staging or production FCM push should be enabled explicitly:

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

`FIREBASE_SERVICE_ACCOUNT_JSON` may be raw JSON or base64 JSON, but it must include `project_id`, `client_email`, and `private_key`.
When using `GOOGLE_APPLICATION_CREDENTIALS`, point it to an existing valid service account JSON file that is available to the API process or Docker container.

Firebase Admin credentials are server-side only. Never send service account JSON, private keys, APNs keys, or Admin SDK credentials to Flutter, Admin Web, browser JavaScript, or Git.
Use `npm.cmd run fcm:credentials:install -- -SourcePath <downloaded-service-account.json> -UpdateEnv` to copy a downloaded Firebase Admin JSON into the ignored `C:\dev\hands-secrets\firebase` folder and write the local `.env` pointers. In Docker, `FIREBASE_ADMIN_CREDENTIALS_HOST_PATH` is bind-mounted into the API container at `FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH` or `/run/secrets/firebase-admin.json`.

When FCM credentials are absent, `PushDeliveryService` fails safely by recording a failed `NotificationDelivery`; the API process and booking/matching flows must not crash. FCM push data is filtered to routing identifiers such as `bookingId`, `chatRoomId`, and profile or payment record ids, and the backend always adds the stored `notificationId` for open/read tracking. Do not place sensitive customer address details, operator notes, or free-form reasons in push bodies or FCM data payloads.

For a narrow Docker/API push check after credentials are configured, use:

```powershell
$env:API_BASE_URL='http://localhost:3000/api'
npm.cmd run external:check:push
npm.cmd run security:secrets
npm.cmd run fcm:credentials-check
npm.cmd run docker:contract
npm.cmd run fcm:token-smoke
$env:FCM_SMOKE_ROLE='CUSTOMER'
$env:FCM_SMOKE_PHONE='+84900000001'
$env:FCM_SMOKE_DEVICE_TOKEN='<real app FCM token>'
$env:FCM_SMOKE_PLATFORM='android'
$env:FCM_SMOKE_EXPECT_PROVIDER='FCM'
$env:FCM_SMOKE_EXPECT_STATUS='SENT'
npm.cmd run fcm:push-smoke
```

The smoke also accepts `-- --env=.env` and merges that file with the current shell environment, so local-only values like `API_BASE_URL` and `FCM_SMOKE_DEVICE_TOKEN` can live outside the command line. Shell variables still win over file values.
Use `npm.cmd run fcm:token-smoke -- --dry-run` to confirm the API URL, platform, and demo actors before writing a synthetic device token.
Use `npm.cmd run fcm:push-smoke -- --dry-run` to confirm the merged env, selected role/phone/platform, credential readiness, and next push-smoke actions before sending a live retry. This mode is config-only and does not contact the API or FCM.
Use `npm.cmd run fcm:push-smoke -- --preflight` to contact the API only and confirm the selected smoke user has a notification plus the required token/reuse inputs before sending FCM.
If the app has already registered an enabled push device for the selected role, phone, and platform, set `FCM_SMOKE_USE_REGISTERED_DEVICE=true` instead of copying the raw token into `FCM_SMOKE_DEVICE_TOKEN`.
Partner-alert notifications are also gated by the `notification.partner_alert_channel` operational policy. When expecting FCM, preflight blocks Partner-alert notifications currently routed to `IN_APP_ONLY` and suggests a recent standard-notification `FCM_SMOKE_NOTIFICATION_ID` for the same role/phone when one exists.

`fcm:token-smoke` registers and disables synthetic customer/Partner device tokens without contacting FCM. The live FCM smoke either registers the real device token from the same role, phone, and platform selected for the smoke run or reuses an already registered enabled device, retries an existing notification, and verifies that a new delivery record is created. It never prints the raw FCM token. If the selected user has no notification yet, run a booking/chat flow first or set `FCM_SMOKE_NOTIFICATION_ID` to a known notification.

Use `npm.cmd run notifications:role-audit` to read the local database and summarize recent notification deliveries whose target role does not match the recorded `PushDevice.role`. The audit is read-only and does not print raw push tokens. Add `-- --strict` when you want the command to fail on mismatches during a release gate.

Use `npm.cmd run notifications:role-repair` for a dry-run list of enabled push devices whose stored role is not present on the owning user. Add `-- --apply` to disable those mismatched devices without deleting records or exposing raw push tokens.

## Mobile Setup Notes

Android uses `google-services.json` and the Google Services Gradle plugin when FCM client integration is added. iOS uses `GoogleService-Info.plist`, APNs key/cert configuration through Firebase, and the Flutter FCM client. These files are secrets/config artifacts and must stay outside Git.

`google-services.json` is mobile client configuration only. It does not authorize backend sends; the NestJS API still needs server-side Firebase Admin credentials through `FIREBASE_SERVICE_ACCOUNT_JSON`, split Firebase service account env values, or `GOOGLE_APPLICATION_CREDENTIALS`.

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
