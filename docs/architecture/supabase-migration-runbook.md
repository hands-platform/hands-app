# Supabase Migration Runbook

## Purpose

HANDS will move away from Firebase and keep the Flutter apps behind Clean Architecture boundaries. Critical booking, payment, verification, and matching writes should continue through the NestJS API until the business flow is fully stable.

## Current Status

- Customer and Partner apps now have feature repositories for auth, discovery, booking, chat, map, notification, coupons, partner profile, earnings, and verification.
- `app_state.dart` is now a compatibility facade for existing screens rather than a direct API integration layer.
- Firebase is limited to FCM push only. Firebase DB/Auth/Firestore and Firebase Storage are not part of the MVP.
- API FCM delivery is behind `PushDeliveryService`; local/dev can keep in-app-only delivery records when Firebase Admin credentials are absent.
- Mobile apps should register FCM tokens after login when the FCM push client setup is enabled.
- `supabase_flutter` is installed but no production flow depends on direct Supabase calls yet.
- `npm.cmd run supabase:schema:check` verifies that the Supabase core SQL draft still includes the current Prisma enum values and MVP tables.

## Client Environment

Flutter run flags:

```powershell
--dart-define=SUPABASE_URL=https://your-project.supabase.co
--dart-define=SUPABASE_ANON_KEY=your-anon-key
--dart-define=AUTH_BACKEND=supabase
API env:
SUPABASE_JWT_SECRET=your-project-jwt-secret
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Existing local run flags still apply:

```powershell
--dart-define=API_BASE_URL=http://10.0.2.2:3000/api
--dart-define=SOCKET_BASE_URL=http://10.0.2.2:3000
--dart-define=MAPTILER_API_KEY=your-maptiler-key
--dart-define=GEOAPIFY_API_KEY=your-geoapify-key
```

Auth backend modes:

- `AUTH_BACKEND=nest` keeps the current NestJS OTP/JWT flow and is the default for MVP stability.
- `AUTH_BACKEND=supabase` routes mobile OTP request and verification through Supabase Auth. Use this only after Supabase phone OTP is configured and the backend API has the matching project URL and publishable key. Keep the legacy JWT secret configured while the project still issues or accepts shared-secret tokens.

The API accepts legacy shared-secret Supabase JWTs through `SUPABASE_JWT_SECRET`. When a project issues signing-key tokens, the API falls back to the Supabase Auth `/auth/v1/user` endpoint using `SUPABASE_URL` and the publishable key, then requires the verified Auth user ID to match the token subject before any local user synchronization. Supabase users are mapped to local Nest users through `User.supabaseUserId`, and phone OTP users are linked by phone number when possible.

Mobile Supabase OTP flow uses a bridge session:

- `AUTH_BACKEND=nest`: mobile verifies OTP directly with Nest and receives Nest API tokens.
- `AUTH_BACKEND=supabase`: mobile first calls Supabase `signInWithOtp`, verifies the SMS code with Supabase, then exchanges the Supabase access token at `/auth/supabase/exchange` for Nest API tokens.
- This keeps provider/customer roles, Socket.IO auth, and existing protected API routes stable while Supabase Auth becomes the OTP identity provider.
- The API does not trust the requested `role` by itself. `CUSTOMER` is the default role, but `PROVIDER` exchange is allowed only when the Supabase token carries a provider role in metadata or when the phone number already maps to a local HANDS provider account. This prevents a customer token from escalating into a provider session.

Provider migration options:

1. Preferred for MVP migration: keep provider onboarding/approval in the Nest admin flow first, then let Supabase OTP link by phone number.
2. Later production option: set partner role metadata through the trusted admin action `POST /api/admin/partners/:id/sync-supabase-role` after verification. Do not let the mobile client self-assign partner role metadata.
3. Run `npm.cmd run auth:supabase-smoke` after configuring `SUPABASE_JWT_SECRET`; the smoke test checks customer mapping, provider mapping, invalid audience rejection, and provider role escalation rejection.
4. Run `npm.cmd run auth:supabase-phone-smoke -- --dry-run` before sending a live SMS. Use `--send` only after setting `SUPABASE_PHONE_SMOKE_PHONE`, then set `SUPABASE_PHONE_SMOKE_OTP` and run `--verify` after the code arrives.

Provider role metadata sync:

- Required API values: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The service role key must stay server-side only and must never be passed to Flutter or Admin Web.
- Admin partner approval automatically attempts a provider role sync when the HANDS user is already linked to `supabaseUserId`.
- If the provider has not signed in through Supabase yet, the sync is skipped and recorded in the audit log. The provider can still operate through the existing Nest auth flow until Supabase OTP is enabled.

Mobile auth code is now split by Clean Architecture boundaries:

- `domain/entities/otp_request.dart`: OTP request result contract.
- `domain/usecases/request_otp.dart`: screen-safe OTP request use case.
- `data/datasources/*_otp_auth_remote_datasource.dart`: Nest or Supabase implementation.
- `presentation/controllers/auth_controller.dart`: UI-facing methods for request and verify.

Screens should call `requestOtp(...)` before `signInWithOtp(...)` when real phone login UI is enabled. The existing demo login remains available for local booking flow testing.

Mobile sessions are persisted with `flutter_secure_storage` after OTP verification:

- Customer key: `hands.customer.auth_session.v1`
- Provider key: `hands.provider.auth_session.v1`
- On app start, the saved Nest API session is restored, the API client receives the access/refresh tokens, and Socket.IO reconnects with the access token.
- Provider restore also brings the provider online and starts the cost-controlled location heartbeat so active providers do not need to log in again after reopening the app.
- Profile sign-out clears the saved session, API tokens, and Socket.IO connection. Provider sign-out also calls `/provider/offline` and stops the location heartbeat before clearing local auth.
- When the Nest access token is refreshed, the new access/refresh token pair is written back to secure storage and Socket.IO reconnects with the latest token.

After the API is running with the same `SUPABASE_JWT_SECRET`, run this smoke test to verify that Supabase-style access tokens are accepted by protected Nest routes:

```powershell
$env:API_BASE_URL="http://localhost:3000/api"
$env:SUPABASE_JWT_SECRET="your-project-jwt-secret"
$env:SUPABASE_JWT_AUDIENCE="authenticated"
npm.cmd run auth:supabase-smoke
```

To test the real Supabase Phone Auth OTP delivery and exchange path:

```powershell
$env:SUPABASE_PHONE_SMOKE_PHONE="+84900000001"
npm.cmd run auth:supabase-phone-smoke -- --send
$env:SUPABASE_PHONE_SMOKE_OTP="<6-digit-code>"
npm.cmd run auth:supabase-phone-smoke -- --verify
```

The emulator/device scripts pass these values from shell environment variables when present:

```powershell
$env:AUTH_BACKEND="supabase"
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-key"
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
```

## SQL

Prisma is the DB source of truth for the active NestJS API runtime. The
Supabase SQL files are staging setup drafts for Supabase Auth/PostgREST/Storage
readiness and must be kept in sync with Prisma enums and core tables before
being applied to a Supabase project.

PostgREST grants in this setup are intentionally read-oriented for `anon` and
`authenticated` roles. Critical booking, payment, settlement, wallet, tax,
admin, and audit writes must continue to go through the NestJS API using
server-side credentials.

Run [hands-core-schema.sql](/C:/dev/massage-on-demand-vn/infra/supabase/hands-core-schema.sql) in the Supabase SQL editor after creating the project.

For a staging project, generate a single ordered SQL bundle first:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run setup:doctor
npm.cmd run supabase:sql:pack
```

The generated file is written to:

```text
C:\dev\massage-on-demand-vn\infra\supabase\.generated\hands-staging-setup.sql
```

Paste that bundle into the Supabase SQL Editor for the HANDS staging project. The bundle includes `hands-core-schema.sql` first and `storage-schema.sql` second. It intentionally excludes `location-schema.sql` because that file is a standalone early draft; the current core schema already includes `provider_locations`, `customer_selected_locations`, and `nearby_providers`.

If the SQL bundle was applied before PostgREST role grants were added and REST requests return `42501 permission denied for table`, apply this patch once:

```text
C:\dev\massage-on-demand-vn\infra\supabase\patches\2026-05-23-postgrest-role-grants.sql
```

The schema includes:

- `profiles`
- `providers`
- `services`
- `provider_services`
- `provider_locations`
- `customer_selected_locations`
- `bookings`
- `booking_address_snapshots`
- `booking_services`
- `booking_participants`
- `chat_rooms`
- `messages`
- `payments`
- `reviews`
- `provider_payout_batches`
- `provider_earnings`
- `notifications`
- `push_devices`
- `notification_deliveries`
- `files`
- `location_snapshots`
- `coupons`
- `refunds`
- `admin_audit_logs`
- `admin_settings`

Storage policies are separated into `infra/supabase/storage-schema.sql` so bucket setup can be reviewed independently from app data tables.

After changing Prisma enums or core models, run:

```powershell
npm.cmd run supabase:schema:check
npm.cmd run supabase:sql:pack
```

This is a drift guard for the migration draft; it does not replace running the SQL in a Supabase staging project.

## Staging Apply Checklist

1. Create a Supabase project named `HANDS Staging`.
2. Open SQL Editor and run the generated `hands-staging-setup.sql` bundle.
3. Confirm there are no SQL errors.
4. In Table Editor, confirm these tables exist: `profiles`, `providers`, `bookings`, `messages`, `provider_locations`, `files`.
5. In Storage, confirm buckets `hands-public` and `hands-private` exist.
6. In Authentication settings, enable Phone Auth and configure Vietnam-capable SMS delivery.
7. Copy these values into the API environment only where appropriate:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
8. Keep `AUTH_BACKEND=nest` until the API smoke and Supabase auth smoke pass.
9. Run `npm.cmd run setup:doctor`.
10. Run `npm.cmd run external:check:supabase`.
11. Start the API with `SUPABASE_JWT_SECRET` and run `npm.cmd run auth:supabase-smoke`.

Current `hands-staging` status:

- The checked-in schema/RLS bundle and synthetic API exchange smoke pass locally.
- The project was restored and reported healthy on 2026-07-14; URL, publishable key, and server key checks pass.
- The remote database reports Postgres `17.6.1.121`; the hosted Postgres 14 support deadline does not affect this project. A later `17.6.1.141` patch upgrade is available but was not applied during the security recovery.
- `2026-07-14-restrict-provider-location-exposure.sql` and `2026-07-14-restrict-default-postgrest-privileges.sql` are applied to the remote main database.
- `npm.cmd run supabase:location-exposure-smoke` returns explicit anonymous denial for both `provider_locations` and `nearby_providers`, while server-key checks still return success.
- Real Customer Phone Auth OTP send/verify, signing-key token validation, Nest token exchange, and protected `/customer/me` access passed on 2026-07-14.
- The same local identity was normalized to Vietnam E.164, retained its Customer profile, gained a Partner profile, passed Admin approval, and synced the Supabase `PROVIDER` role. A final fresh Partner OTP verify and protected `/provider/me` request remain pending because Vonage Vietnam delivery used TTS voice fallback and subsequent repeated requests did not arrive. Stop retries until the `HANDS` sender is registered or an approved Vietnam SMS provider is connected.

Rollback during staging is simple: create a fresh staging Supabase project and rerun the generated bundle. Do not run destructive SQL against production-like data until backup/restore has been tested.

## Safe Migration Order

1. Keep NestJS OTP/JWT login as the mobile auth boundary.
2. Add Supabase PostgreSQL as the backing database under the API.
3. Move file metadata and verification uploads to Supabase Storage through the API.
4. Keep notification rows as the audit/in-app source of truth.
5. Add or enable FCM credentials and mobile config for FCM push.
6. Move chat history to Supabase tables, while keeping Socket.IO events until delivery semantics are validated.
7. Keep FCM behind `PushDeliveryService` and do not introduce Firebase DB/Auth/Firestore.

## Risk Notes

- Supabase Realtime is not a push notification replacement.
- RLS is a guardrail, not the only security layer. Booking finalization, matching, refunds, and payment capture must remain server-owned.
- Direct mobile Supabase writes should be limited to low-risk data until RLS and audit logging are verified.
