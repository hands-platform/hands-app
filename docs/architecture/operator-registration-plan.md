# HANDS Operator Registration Plan

This file is the operator-facing order for external console setup. Keep secrets out of Git and copy final values into local `.env` or the staging env template only.

Recommended secret folder:

```text
C:\dev\massage-vn-workspace\secrets
```

Business identity:

- Domain: `hands.vn`
- Admin/operator email: `administration@hands.vn`
- Registrar/DNS: PA Vietnam, `https://www.pavietnam.vn`
- DNS permission: operator can add and delete records directly
- Public web URL: `https://hands.vn`
- API URL: `https://api.hands.vn`
- Admin URL: `https://admin.hands.vn`

External account migration details:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\external-account-migration.md
```

Primary fill-in template:

```text
C:\dev\massage-vn-workspace\repo\infra\env\hands-staging.env.example
```

Generated handoff pack:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run external:pack:write
```

Output:

```text
C:\dev\massage-vn-workspace\repo\infra\setup\.generated\hands-external-registration-pack.md
```

Operations dashboard runbook:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\operations-dashboard.md
```

## Current Status

- Local MVP services: ready on API `3100` and Admin `3101`
- Firebase mobile SDKs: removed
- Android upload signing: ready locally for customer and partner apps
- Release APK build: verified for customer and partner apps
- Local storage: ready through MinIO-compatible S3 settings
- GitHub business repository: moved to `hands-platform/hands-app`
- Supabase staging: created and SQL applied
- MapTiler and Geoapify: configured locally and verified
- Runtime operations policy: managed in Admin at `/operations-policy`
- External production-like registrations still pending: production SMS Phone Auth, OneSignal, MoMo/VNPay, production storage/CDN

## Registration Order

### 0. Domain And Account Ownership

Purpose:

- Make every external service owned by the HANDS business account, not a personal/dev account.

Use:

- `hands.vn`
- `administration@hands.vn`
- PA Vietnam DNS management: `https://www.pavietnam.vn`

Register or transfer:

- GitHub organization/repository: `hands-platform/hands-app`
- Supabase
- MapTiler
- Geoapify
- OneSignal
- Storage/CDN
- MoMo/VNPay merchant accounts
- SMS provider if separate from Supabase Phone Auth

Set:

```dotenv
APP_DOMAIN=hands.vn
PUBLIC_WEB_URL=https://hands.vn
API_PUBLIC_URL=https://api.hands.vn
ADMIN_PUBLIC_URL=https://admin.hands.vn
ADMIN_EMAIL=administration@hands.vn
SUPPORT_EMAIL=administration@hands.vn
```

### 1. Supabase Staging

Purpose:

- Supabase Auth for phone OTP migration
- PostgreSQL schema and RLS baseline
- Storage-ready project for later file migration

Registered:

- Supabase project named `hands-staging`
- Project URL
- anon key
- JWT secret
- service role key
- generated SQL bundle applied

Deferred:

- Phone Auth with selected SMS provider, until OTP E2E setup

Set:

```dotenv
AUTH_BACKEND=nest
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=
```

Keep `AUTH_BACKEND=nest` until Supabase Phone Auth smoke tests pass. Switch to `AUTH_BACKEND=supabase` only for the dedicated Supabase auth test pass.

Verify:

```powershell
npm.cmd run supabase:sql:pack
npm.cmd run external:check:supabase
npm.cmd run auth:supabase-smoke
```

Do not enable `AUTH_BACKEND=supabase` for normal app testing until SMS Phone Auth is configured and verified.

### 2. MapTiler And Geoapify

Purpose:

- MapTiler renders low-cost map tiles.
- Geoapify handles address search/geocoding.
- No Google Maps, Directions API, Routing API, or realtime route streaming for MVP.

Registered:

- MapTiler API key: completed for staging/local development
- Geoapify API key: completed for staging/local development

Set:

```dotenv
MAPTILER_API_KEY=
GEOAPIFY_API_KEY=
```

Keep the real values only in ignored local env files or the external secret store; never commit them.

Verify:

```powershell
npm.cmd run external:check:maps
```

### 3. Runtime Operations Policy

Purpose:

- Keep matching, marketplace participation, wallet gate, cancellation, no-show, and notification behavior configurable from Admin.
- Avoid hardcoding dispatch or settlement policy in mobile screens.

Current recommended MVP policy:

- Preferred partner response window: 10 minutes.
- Marketplace partner radius: 10km.
- Marketplace partner location freshness: 30 minutes.
- Marketplace partner invite cap: 50.
- Marketplace partners can appear immediately while the preferred partner is still deciding.
- Customer makes the final partner selection.
- Partners with negative wallet balance can still see marketplace requests but cannot join until settlement, but final acceptance or customer final partner selection is blocked when the configured gate requires settlement.

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

Operate:

```text
http://localhost:3101/operations-policy
```

Verify:

```powershell
npm.cmd run admin:web-smoke
node infra\scripts\api-smoke.mjs
```

### 4. Payments

Purpose:

- Real MoMo/VNPay authorization, capture, release, and refund E2E.
- Cash remains available without external credentials.

Register:

- MoMo sandbox merchant credentials
- VNPay sandbox merchant credentials
- Callback and return URLs for staging domains later

Set:

```dotenv
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
```

Verify:

```powershell
npm.cmd run external:check:payments
node infra\scripts\api-smoke.mjs
```

### 5. OS Push Provider

Purpose:

- Closed-app push notification delivery after in-app notification flow is stable.
- Firebase Messaging should stay removed unless the push strategy intentionally changes.

Recommended provider:

- OneSignal or equivalent provider with server-side REST delivery

Set for local MVP:

```dotenv
PUSH_PROVIDER=in_app_only
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Set for production-like push E2E:

```dotenv
PUSH_PROVIDER=onesignal
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Verify:

```powershell
npm.cmd run external:check:production
```

### 6. Production SMS Decision

Purpose:

- Real phone OTP delivery in Vietnam.
- Use Vonage for the next Phone Auth/SMS E2E pass, then evaluate Viettel/FPT or another Vietnam-capable backend only if delivery or cost requires it.

Set only if the backend SMS provider is used:

```dotenv
SMS_PROVIDER=
SMS_API_URL=
SMS_API_KEY=
SMS_SENDER_ID=HANDS
```

Local development can stay:

```dotenv
SMS_PROVIDER=dev
DEV_OTP=123456
```

### 7. Storage/CDN

Purpose:

- Private provider verification files
- Public provider profile media
- CDN-ready file delivery

Current local MVP can keep MinIO. For staging/production, choose one:

- Supabase Storage S3
- Cloudflare R2
- S3-compatible storage

Set:

```dotenv
STORAGE_PROVIDER=s3-compatible
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_BASE_URL=
```

Verify:

```powershell
npm.cmd run external:check:storage
```

### 8. Android Store Registration

Purpose:

- Customer/partner apps have separate release upload keys and package names.
- Fingerprints are needed for stores or external providers that support Android app restrictions.

Already generated locally:

```text
C:\dev\massage-vn-workspace\secrets\android-signing\hands-customer-upload.jks
C:\dev\massage-vn-workspace\secrets\android-signing\hands-provider-upload.jks
C:\dev\massage-vn-workspace\secrets\android-signing\android-signing-summary.txt
```

Verify:

```powershell
npm.cmd run external:check
flutter build apk --release
```

## Final Production-Like Check

Run this only after all external console values are filled:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run external:check:production
npm.cmd run verify:local -- -WithServices
```
