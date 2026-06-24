# Mobile API Integration

## Customer App

The customer Flutter app now includes:

- Demo OTP login against `POST /api/auth/verify-otp`
- JWT storage in Riverpod state for the current runtime session
- API client with Bearer token headers
- Socket.IO client using JWT handshake auth
- Service catalog loading from `GET /api/services`
- Nearby partner loading from `GET /api/customer/partners/nearby`
- Global app access: when the customer is outside Vietnam or GPS is unavailable, discovery uses a Vietnam service-area browse pin so partner lists remain visible.
- Booking creation still requires the customer to confirm an exact Vietnam service address pin, which the API stores as an immutable `BookingAddressSnapshot`.
- Booking creation through `POST /api/customer/bookings`
- Booking room join after booking creation
- Realtime UI updates for `provider.joined`, `booking.matched`, `booking.expired`, and `provider.location.updated`

Run with custom endpoints:

```powershell
cd C:\dev\massage-on-demand-vn\apps\customer_app
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000/api --dart-define=SOCKET_BASE_URL=http://10.0.2.2:3000
```

## Partner App

The partner Flutter app now includes:

- Demo OTP login against `POST /api/auth/verify-otp`
- JWT storage in Riverpod state for the current runtime session
- API client with Bearer token headers
- Socket.IO client using JWT handshake auth
- Online/offline API calls
- A location update when going online, then cost-controlled refreshes: 60 minutes or 3000m movement while idle, and at most every 30 minutes during an active booking
- Open booking loading from `GET /api/partner/bookings/open`
- Join booking through `POST /api/partner/bookings/:id/join`
- Accept/reject participation through `POST /api/partner/bookings/:id/accept` and `POST /api/partner/bookings/:id/reject`
- Request screen state for online status, first-pick jobs, marketplace jobs, participating jobs, and customer-selection waiting state
- Socket listeners for `booking.opened`, `booking.matched`, and `booking.expired`

## Realtime MVP Behavior

- Partner sockets join a shared `providers:online` room after JWT authentication.
- When a booking opens, the backend emits `booking.opened` to the booking room, the first-pick partner, and eligible marketplace partners.
- The first-pick partner response window is 10 minutes.
- Marketplace partners can participate only when their last stored location is within the configured radius of the booking location.
- Eligible marketplace partners receive a marketplace availability notification and see the request in `GET /api/partner/bookings/open`.
- Customer app refreshes the active booking when a partner participates or the booking status changes.
- Partner app refreshes open jobs when a new booking opens or a matching job changes state.

## Current Limitations

- Tokens are runtime-only and not persisted securely yet.
- UI is intentionally MVP-plain and close to the reference flow hierarchy, not final branding.
- Google Maps has been replaced for MVP by MapTiler/MapLibre map rendering and Geoapify address search.
- Notification setup runs after login and should register FCM tokens through `POST /api/mobile/devices/register` when mobile push integration is enabled. Firebase DB/Auth/Firestore remain outside the MVP.
- `flutter pub get`, `flutter analyze`, and widget smoke tests pass for both customer and partner apps in the local Windows environment.
- Android platform folders are generated for both Flutter apps.
- Customer and Partner apps have been build-installed-launched on `emulator-5554` from an ASCII-only path.
- Windows Android builds should run from an ASCII-only path such as `C:\dev\massage-on-demand-vn`; the original workspace path contains Korean characters and can trigger Android/Flutter toolchain failures.

## iOS-Ready Backend Foundation

The current backend is prepared to accept future Android, iOS, and Web device registrations without introducing Firebase DB/Auth or any iOS app code:

- `POST /api/mobile/devices/register` requires a customer or Partner JWT and accepts `ANDROID`, `IOS`, or `WEB`.
- Device registration stores FCM as the push provider plus app/device metadata: app version, OS version, device model, locale, and timezone.
- Existing notification compatibility routes remain Android/iOS-only for older builds.
- `GET /api/mobile/app-version?appType=CUSTOMER&platform=IOS` and the equivalent Partner/Android queries provide a per-platform force-update contract.
- `npm.cmd run prisma:seed --workspace @massage-vn/api` creates inactive-blocking default CUSTOMER/PARTNER Android and iOS app-version rows with `forceUpdate=false`, so mobile builds receive a database-backed policy before operations customizes versions.
- `npm.cmd run mobile:foundation-smoke` checks the database-backed app-version policies plus customer/Partner Android and iOS device registration, same-token upsert, and unregister behavior without printing raw FCM tokens.

## Deferred Auth Identity Design

Current auth maps Supabase Auth users to HANDS users through `User.supabaseUserId` and phone-based OTP flows. Apple Login is not implemented in this phase. Before adding Apple or Google identity linking, add a dedicated identity table owned by the NestJS auth boundary, for example:

- `userId`
- `provider` (`PHONE`, `GOOGLE`, `APPLE`)
- `providerSubject`
- `email`
- `phone`
- `linkedAt`
- `lastUsedAt`

Do not add mobile-app-only identity writes that bypass NestJS. Mobile clients should exchange external provider credentials with the NestJS API, and the API should decide whether to link, create, or reject an identity.

## Deferred Referral Deep Link Design

Referral attribution must stay platform-neutral until customer and Partner iOS apps exist. The backend can already store referral attribution with a platform value, and setup checks reserve separate Android/iOS store URLs for customer and Partner apps. When referral link routing is implemented, keep these rules:

- Referral link clicks should resolve the target app (`CUSTOMER` or `PARTNER`) and detected platform (`ANDROID`, `IOS`, or unknown web fallback) before redirecting to an app store.
- Link clicks must not create wallet credits, SMS sends, map lookups, push sends, payment callbacks, or booking-side effects.
- Signup attribution should be claimed by the authenticated mobile app through the NestJS referral API after account creation, not by direct Supabase writes.
- Customer referral rewards are only eligible after the referred customer completes and pays for an eligible booking under the active admin policy.
- Partner referral rewards are only eligible after the referred Partner completes the first eligible booking under the active admin policy.
- Store URLs and public referral base URLs belong in external setup/env checks, not hardcoded mobile or admin code.

Do not add iOS-only referral tables. If more detail is required later, extend the existing referral attribution model with target app, platform, install source, and claim timestamps through NestJS-owned writes.

## Platform-Neutral Location Policy

Partner and customer location collection must not depend on iOS background tracking or Android-only continuous GPS. HANDS location policy is cost-controlled and event-based:

- Customer discovery can be browsed globally, but booking creation requires a confirmed Vietnam service address inside the active service area.
- Customer current GPS is used only as a safety check; if fresh current GPS is 50km or more away from the selected service address, booking creation is rejected.
- Partner location is updated when the Partner goes online, while the app is open and online, or at lifecycle points where evidence matters.
- Idle Partner refreshes should remain coarse and cost-controlled; active booking refreshes should stay bounded by the current policy window.
- Completion, cancellation, and arrival evidence may capture a point-in-time Partner location only when the action occurs.
- If GPS is denied or temporarily unavailable, the API may use the last trusted Partner location where the business rule allows it.

Do not introduce background always-on tracking as an iOS requirement. Mobile clients should send explicit location updates to the NestJS API, and the API should decide whether the update is accepted, ignored as too frequent, or used for matching evidence.

## Mobile Firebase Removal Check

The Flutter apps may use Firebase Messaging for FCM push. They must not use Firebase Realtime Database, Firestore, Firebase Auth, or Firebase Storage. Google service config files must stay outside Git.

Verification command:

```powershell
node infra/scripts/check-mobile-firebase.mjs
```

This command is also included in `powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices`.

## Physical Device Run

For a real Android phone connected by USB, prefer the helper script from the workspace root:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-mobile-device.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-mobile-device.ps1 -App provider
```

The script:

- checks that exactly one Android device is connected, or requires `-DeviceId`
- runs `adb reverse tcp:3000 tcp:3000`
- launches Flutter with:
  - `API_BASE_URL=http://127.0.0.1:3000/api`
  - `SOCKET_BASE_URL=http://127.0.0.1:3000`

## Emulator Run

For local Android Emulator testing, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App provider
```

The script:

- checks that the HANDS API is already running on `localhost:3000`
- starts `Pixel_6_API_33` if no emulator is already connected
- waits for Android boot completion
- launches Flutter with:
  - `API_BASE_URL=http://10.0.2.2:3000/api`
  - `SOCKET_BASE_URL=http://10.0.2.2:3000`
