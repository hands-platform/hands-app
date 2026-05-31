# HANDS External Setup Checklist

This checklist records the external accounts, keys, and console setup needed before HANDS moves from local MVP testing to real Vietnam-wide operation.

For the recommended operator order, use:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\operator-registration-plan.md
```

Keep secrets outside Git. The recommended local secret folder is:

```powershell
C:\dev\massage-vn-workspace\secrets
```

Use this staging template as the fill-in checklist when you receive external console values:

```text
C:\dev\massage-vn-workspace\repo\infra\env\hands-staging.env.example
```

Use this admin runbook to understand the first-screen operating KPIs:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\operations-dashboard.md
```

## Project Identity

- App name: `HANDS`
- Domain: `hands.vn`
- Admin/operator email: `administration@hands.vn`
- Registrar/DNS provider: PA Vietnam, `https://www.pavietnam.vn`
- DNS permission: operator can add and delete records directly
- GitHub organization target: `hands-platform`
- GitHub repository target: `https://github.com/hands-platform/hands-app`
- Current GitHub migration status: connected and pushed from local `develop`
- Service area: all Vietnam, starting with local MVP flows around Ho Chi Minh City
- Customer app languages planned later: Vietnamese, English, Korean, Chinese, Japanese
- Partner app language planned later: Vietnamese
- Admin languages planned later: Korean, Vietnamese, English

## 1. Push Notifications

The Flutter apps no longer use Firebase mobile SDKs. MVP notification behavior is in-app first, backed by persisted notification records.

Future OS-level push still needs a provider decision:

- Recommended direction: OneSignal or another push provider with a backend adapter
- Current local mode: `IN_APP_ONLY` in `apps/api/src/notifications/push-delivery.service.ts`
- Server-side OneSignal REST delivery adapter: implemented, but inactive until `PUSH_PROVIDER=onesignal` and credentials are configured
- Mobile apps should not restore `google-services.json` unless the push strategy changes intentionally

Planned provider value:

```dotenv
PUSH_PROVIDER=in_app_only
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Use this only after the partner app, customer app, and backend adapter are ready for production-like push E2E:

```dotenv
PUSH_PROVIDER=onesignal
ONESIGNAL_APP_ID=<onesignal-app-id>
ONESIGNAL_REST_API_KEY=<server-rest-api-key>
```

`ONESIGNAL_REST_API_KEY` is API-server only. Do not put it in Flutter, Admin Web, screenshots, or GitHub.

Verification:

```powershell
cd C:\dev\massage-vn-workspace\repo
node .\infra\scripts\check-mobile-firebase.mjs
npm.cmd run external:check:production
```

## 2. Low-Cost Maps And Address Search

MVP map/location uses MapTiler + MapLibre and Geoapify instead of Google Maps.

Required accounts:

- MapTiler account and API key for map tiles/styles
- Geoapify account and API key for Vietnam address search/geocoding
- Supabase account is optional now because the MVP stores location through the NestJS API, but the SQL is ready under `infra/supabase/location-schema.sql`

Local run values:

```powershell
$env:MAPTILER_API_KEY="your-maptiler-key"
$env:GEOAPIFY_API_KEY="your-geoapify-key"
```

The mobile helper scripts also load these values from the ignored root `.env`, so a normal local run does not need repeated manual exports.

Verify that both keys exist and the external APIs are reachable:

```powershell
npm.cmd run external:check:maps
```

Supabase values used by Auth now and direct database/storage later:

```dotenv
SUPABASE_URL=https://adzpstrkpzwpukuboxzj.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=
AUTH_BACKEND=nest
```

Recommended local auth setting while the product flow is still changing:

```dotenv
AUTH_BACKEND=nest
```

Switch mobile OTP to Supabase only after Supabase Phone Auth and the API JWT secret are configured:

```dotenv
AUTH_BACKEND=supabase
SUPABASE_URL=https://adzpstrkpzwpukuboxzj.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_JWT_SECRET=<project-jwt-secret>
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

The Flutter run scripts pass MapTiler and Geoapify keys as Dart defines:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App provider
```

## 3. Runtime Operations Policy

Operational rules are managed from Admin so dispatch and finance behavior can change without rebuilding the apps.

Admin page:

```text
http://localhost:3101/operations-policy
```

Current MVP policy:

- selected first partner response window: `10` minutes
- backup partner radius: `10km`
- backup partner location freshness: `30` minutes
- backup partners can appear while the first partner is still deciding
- customer always selects the final partner
- negative partner wallet blocks booking acceptance
- cancellation and no-show decisions require admin review first

Seed/default values:

```dotenv
MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES=10
MATCHING_BACKUP_PROVIDER_RADIUS_METERS=10000
MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES=30
MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT=50
MATCHING_PREFERRED_ACCEPT_MODE=CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT
MATCHING_BACKUP_OPEN_MODE=IMMEDIATE_WITHIN_WINDOW
WALLET_NEGATIVE_BALANCE_GATE=BLOCK_ACCEPTS_WHEN_NEGATIVE
CANCELLATION_AFTER_MATCH_POLICY=ADMIN_REVIEW_FOR_MVP
NO_SHOW_PARTNER_REPORT_POLICY=ADMIN_REVIEW_REQUIRED
NOTIFICATION_PARTNER_ALERT_CHANNEL=IN_APP_WITH_PUSH_LATER
```

Verify:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run admin:web-smoke
node .\infra\scripts\api-smoke.mjs
```

## 4. SMS / OTP

Development uses a fixed OTP:

```dotenv
SMS_PROVIDER=dev
DEV_OTP=123456
```

Production needs:

```dotenv
SMS_PROVIDER=your-provider
SMS_API_URL=https://provider.example/api
SMS_API_KEY=your-secret-key
SMS_SENDER_ID=HANDS
```

Decision still needed:

- Supabase Phone Auth SMS provider or a backend SMS provider
- OTP rate limits
- resend cooldown
- fraud monitoring rules

Supabase Auth setup:

1. Create or open the Supabase organization/workspace `HANDS` and project `hands-staging`.
2. Enable Phone provider in Authentication.
3. Configure the SMS provider supported by Supabase for Vietnam delivery.
4. Copy `Project URL`, `anon public`, and the JWT secret into the local `.env`.
5. Keep `AUTH_BACKEND=nest` until OTP sending is verified, then test `AUTH_BACKEND=supabase` on customer and partner apps.
6. Provider Supabase login must not rely on a client-selected role. A provider can exchange a Supabase session only if the phone number already belongs to an approved/local HANDS provider account or the admin provider-role sync has placed `PROVIDER` in Supabase user metadata.
7. After setting `SUPABASE_JWT_SECRET`, run `npm.cmd run auth:supabase-smoke` against the API to verify customer mapping, provider mapping, invalid audience rejection, and role escalation rejection. The full local verifier also runs this flow with a temporary dev JWT secret against its managed API.
8. Keep `SUPABASE_SERVICE_ROLE_KEY` only in the API environment. It is needed for admin provider-role sync and must never be sent to Flutter, browser JavaScript, or Git.

## 5. Payments

MVP supports:

- Cash
- MoMo
- VNPay

MoMo production values:

```dotenv
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
```

VNPay production values:

```dotenv
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
```

Before launch, confirm:

- authorization / release / capture behavior
- refund behavior
- callback URL
- return URL
- sandbox merchant separated from production merchant
- admin manual refund permissions

## 6. Storage / CDN

MVP can run on local MinIO. Production should use Supabase Storage S3, S3-compatible storage, or Cloudflare R2.

Required values:

```dotenv
STORAGE_PROVIDER=s3-compatible
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_PRIVATE_BUCKET=
S3_PUBLIC_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_BASE_URL=
```

Supabase Storage S3 example:

```dotenv
STORAGE_PROVIDER=supabase-storage-s3
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_REGION=auto
S3_BUCKET=
S3_PRIVATE_BUCKET=hands-private
S3_PUBLIC_BUCKET=hands-public
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/hands-public
```

Rules:

- Provider verification files stay private.
- Public provider profile media can be served through CDN.
- Prefer separate `hands-private` and `hands-public` buckets for Supabase Storage so verification files can never be exposed through the public media URL.
- Never commit uploaded files or service account credentials.
- Supabase projects should use the generated staging SQL bundle so schema, buckets, and RLS policies are applied in the expected order.

Generate the bundle before applying Supabase SQL:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run supabase:sql:pack
```

Then paste this generated file into the Supabase SQL Editor:

```text
C:\dev\massage-vn-workspace\repo\infra\supabase\.generated\hands-staging-setup.sql
```

After S3-compatible storage credentials are filled, run a real upload/read smoke:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run external:check:storage
npm.cmd run storage:smoke
```

## 7. Domains / Deployment

Production preparation:

- API domain
- Admin domain
- TLS certificates
- Nginx reverse proxy
- CORS origin list
- production `.env`
- backup and restore schedule
- GitHub Actions later, after the MVP flow stabilizes

## 8. Admin Access

Local defaults:

```dotenv
ADMIN_API_BASE_URL=http://localhost:3100/api
ADMIN_DEMO_PHONE=+84900000099
ADMIN_DEMO_OTP=123456
```

Before launch:

- create real admin accounts
- disable demo OTP
- rotate JWT secrets
- define owner / operator / finance permissions
- enable audit log review for payout, refund, partner approval, and coupon changes

## 9. Android Store Signing

Detailed runbook:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\android-release-signing.md
```

Current local app IDs:

- Customer app: `com.massagevn.customer.customer_app`
- Partner app: `com.massagevn.provider.provider_app`

Local MVP builds intentionally use the debug signing key so emulator/device testing stays simple. Before Play Store or production distribution:

- create separate upload keys for customer and partner apps
- store keystores outside Git, preferably under `C:\dev\massage-vn-workspace\secrets`
- copy `apps/customer_app/android/key.properties.example` to `apps/customer_app/android/key.properties` and fill local secret values
- copy `apps/provider_app/android/key.properties.example` to `apps/provider_app/android/key.properties` and fill local secret values
- release builds automatically use `android/key.properties` when it exists and fall back to debug signing for local MVP builds
- record SHA-1/SHA-256 fingerprints for any provider that requires Android app restrictions
- never commit keystores, passwords, or Play Console credentials

Recommended helper:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run android:signing:create
```

The helper writes keystores under:

```text
C:\dev\massage-vn-workspace\secrets\android-signing
```

It also writes ignored app-local signing files:

```text
C:\dev\massage-vn-workspace\repo\apps\customer_app\android\key.properties
C:\dev\massage-vn-workspace\repo\apps\provider_app\android\key.properties
```

The fingerprint handoff file is:

```text
C:\dev\massage-vn-workspace\secrets\android-signing\android-signing-summary.txt
```

## One-Time Full Check

Generate the external registration pack first. It lists all accounts, console paths, Android package names, env values, and verification commands in one place:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run setup:doctor
npm.cmd run external:pack
npm.cmd run external:pack:write
npm.cmd run supabase:sql:pack
```

The generated registration pack is written to:

```text
C:\dev\massage-vn-workspace\repo\infra\setup\.generated\hands-external-registration-pack.md
```

Run this before real device or emulator testing:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run external:check
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

Run phase-specific checks before each external E2E pass:

```powershell
npm.cmd run external:check:supabase
npm.cmd run external:check:maps
npm.cmd run external:check:payments
npm.cmd run external:check:storage
```

Run production mode only before production-like E2E testing, because it requires every recommended external integration at once:

```powershell
npm.cmd run external:check:production
```

## Current Local Status

Last checked from `C:\dev\massage-vn-workspace\repo` on 2026-05-28:

- Mobile Firebase dependencies/config: removed
- Full local verification with Docker services: passing, including API smoke, realtime smoke, Supabase Auth exchange smoke, Flutter analyze, and Flutter tests
- Docker host port binding guard: enabled in `infra/scripts/verify-local.ps1`
- OS-level push provider: OneSignal server adapter is implemented, production account values still pending
- Push provider mode: `PUSH_PROVIDER=in_app_only` locally
- MapTiler API key: configured locally in ignored `.env`; style API verification passing
- Geoapify API key: configured locally in ignored `.env`; geocoding verification passing
- Supabase URL / anon key / JWT secret / service role key: configured locally in ignored `.env`
- Supabase SQL bundle: applied successfully to `hands-staging`
- Supabase Phone Auth provider screen: do not fill yet; production SMS OTP is deferred
- Supabase REST/storage verification: passing with service role
- API Supabase auth smoke: passing locally
- Runtime operations policy: exposed in Admin Setup and Operations Policy, covered by admin web smoke and API smoke
- No-show closeout alerts: customer and partner notification rows are created when Admin marks no-show, with `/notifications?review=no-show` and booking detail trace coverage
- Supabase Phone Auth/SMS: deferred
- Planned SMS provider path: Twilio Verify for beta, then Viettel/FPT or another Vietnam-capable production provider
- Mobile auth switch: still `AUTH_BACKEND=nest` locally until SMS provider + Supabase Phone Auth E2E is configured
- Secret hygiene: Supabase publishable/anon/service/JWT secret values, MapTiler, and Geoapify keys must stay only in ignored `.env` files or external secret storage, never in Git
- Local MinIO storage: ready for MVP
- Production SMS provider: not selected/finalized, credentials not filled
- MoMo / VNPay merchant credentials: not filled
- Production S3 or Cloudflare R2: not filled, local MinIO is enough for MVP

Phase-specific external checks currently block only on missing external console values:

- `supabase-auth`: deferred until SMS provider credentials and Supabase Phone Auth are ready
- `maps`: ready locally with MapTiler and Geoapify keys
- `payments`: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`

The next external setup items to complete are:

- production push provider decision
- OneSignal app ID and REST API key, only when OS push E2E starts
- SMS provider credentials, only when Supabase Phone Auth/SMS E2E starts
- MoMo and VNPay merchant credentials, only when payment E2E starts

## Recommended Fill Order

1. Supabase project URL / anon key / JWT secret
2. MapTiler and Geoapify keys
3. Runtime operations policy review in Admin
4. Supabase Phone Auth SMS configuration with selected provider
5. MoMo and VNPay credentials
6. Storage / CDN credentials
7. Production push provider
8. Production domains and TLS
