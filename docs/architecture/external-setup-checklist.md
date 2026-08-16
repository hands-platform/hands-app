# HANDS External Setup Checklist

Use this checklist only for external console readiness. Keep real secrets outside Git under:

```text
C:\dev\hands-secrets
```

Canonical operator order:

- `docs/architecture/operator-registration-plan.md`
- `infra/env/hands-staging.env.example`
- `infra/setup/.generated/hands-external-registration-pack.md`

Before a staging or production release, run the combined fail-closed gate:

```powershell
npm.cmd run external:check:release
```

The command succeeds only when strict external configuration and live public DNS/TLS/HTTPS checks both pass. Its output contains blocker names and next actions, but does not copy configured credential values.

## Business Identity

- App: `HANDS`
- Domain: `hands.vn`
- Admin email: `administration@hands.vn`
- DNS: PA Vietnam
- GitHub: `hands-platform/hands-app`
- Service area: Vietnam

## Current Status

| Area            | Status                                                                                                     | Next action                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| GitHub          | Connected to HANDS org repo                                                                                | Keep pushing `develop`                                              |
| Supabase        | `hands-staging` is active; core URL/key checks pass, anonymous exact-location/RPC access is denied, real Customer Phone Auth plus Nest exchange passed, and the Partner account was linked, approved, and role-synced on 2026-07-14 | Keep broad mobile rollout staged until a fresh Partner OTP can be received and exchanged |
| MapTiler        | Local/staging key configured and live style check passes                                                   | Keep key out of Git                                                 |
| Geoapify        | Local/staging key configured and Vietnam geocoding check passes                                            | Keep key out of Git                                                 |
| Firebase        | FCM allowed for push only                                                                                  | Do not use Firebase DB/Auth/Firestore                               |
| Push            | Server-side FCM path live-smoked with a registered device                                                  | Keep broad rollout behind audit evidence and token freshness checks |
| SMS             | Supabase and mobile clients request SMS through Vonage, but Vietnam delivery fell back to a TTS call and repeated requests reached the provider delivery/rate-limit boundary | Register the `HANDS` sender for Vietnam or connect an approved Vietnam SMS provider before retrying live Partner OTP |
| Referrals       | Admin policy and public link scaffolding exist                                                            | Store URLs and attribution smoke deferred                           |
| Storage         | Local MinIO upload/read smoke passes                                                                       | Supabase Storage S3/R2 production choice later                      |
| Android signing | Local helper ready                                                                                         | Production keystores stay in secrets folder                         |
| Payments        | Cash active, MoMo/VNPay adapters exist                                                                     | Merchant sandbox credentials last                                   |

## Deferred capability ledger

The authenticated Admin Setup workspace at `/setup?mode=readiness&view=deferred` is the operator ledger for future external work. The current `CASH_ONLY` launch manifest contains exactly three deferred capabilities: MoMo payments, VNPay payments, and Referral app links. They remain visible for planning but do not contribute to the current-stage blocker count.

`FutureReadiness` has three states:

- `NOT_STARTED`: no current re-entry prerequisite is verified.
- `PARTIAL`: at least one current prerequisite is verified, but one or more remain pending.
- `READY_FOR_REENTRY`: every prerequisite in the current release profile is verified. Future-platform checks are excluded until that profile is activated.

Review triggers:

- MoMo: the online-payment phase is approved.
- VNPay: the online-payment phase and public DNS/TLS are approved.
- Referral links: public referral sharing, an Android store release, or a referral campaign enters scope.

The Referral release profile is currently `ANDROID_MVP`. It requires the public base URL and both Android store destinations; Android device routing must still be smoke-verified before re-entry. iOS destinations stay future work until `IOS_RELEASE` is activated. A configured URL is configuration evidence only and does not replace device-routing or functional payment smoke evidence.

All operator review times and audit timestamps for this workflow are interpreted and reported in Vietnam local time, `Asia/Ho_Chi_Minh` (`UTC+7`).

## Required Env Groups

```dotenv
APP_DOMAIN=hands.vn
PUBLIC_WEB_URL=https://hands.vn
API_PUBLIC_URL=https://api.hands.vn
ADMIN_PUBLIC_URL=https://admin.hands.vn
ADMIN_EMAIL=administration@hands.vn
SUPPORT_EMAIL=administration@hands.vn
REFERRAL_PUBLIC_BASE_URL=https://hands.vn
REFERRAL_CUSTOMER_ANDROID_STORE_URL=
REFERRAL_CUSTOMER_IOS_STORE_URL=
REFERRAL_PARTNER_ANDROID_STORE_URL=
REFERRAL_PARTNER_IOS_STORE_URL=
```

For the current Android MVP release gate, `REFERRAL_PUBLIC_BASE_URL` and both Android Store URLs are required. The Google Play URLs must target `com.massagevn.customer.customer_app` and `com.massagevn.provider.provider_app`. The iOS Store URLs remain visible but deferred until the customer and Partner iOS apps enter release preparation.

```dotenv
AUTH_BACKEND=nest
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=
```

```dotenv
MAPTILER_API_KEY=
GEOAPIFY_API_KEY=
```

```dotenv
PUSH_PROVIDER=fcm
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_SERVICE_ACCOUNT_JSON=
GOOGLE_APPLICATION_CREDENTIALS=
FIREBASE_ADMIN_CREDENTIALS_HOST_PATH=
FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH=/run/secrets/firebase-admin.json
```

```dotenv
SMS_PROVIDER=dev
DEV_OTP=123456
SMS_API_URL=
SMS_API_KEY=
SMS_API_SECRET=
SMS_SENDER_ID=HANDS
```

## Verification Commands

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run setup:doctor
npm.cmd run external:check
npm.cmd run external:check:push
npm.cmd run external:check:network:dry-run
npm.cmd run security:secrets
npm.cmd run notifications:push-data-contract
npm.cmd run notifications:retry-audit-contract
npm.cmd run fcm:credentials-check
npm.cmd run docker:contract
npm.cmd run fcm:token-smoke -- --dry-run
npm.cmd run fcm:push-smoke -- --dry-run
npm.cmd run fcm:push-smoke -- --preflight
npm.cmd run external:check:maps
npm.cmd run external:check:referrals
```

Owner sequencing decision (2026-07-14): the project remains local-first until product completeness reaches at least 95%. Server purchase, hosting, public DNS/TLS, merchant sandbox registration, live Partner OTP delivery, and store-link E2E are intentionally deferred. Keep their gates fail-closed, but do not run them as routine local-development checks.

After the 95% gate, server purchase, final DNS records, and certificates are active, run the live read-only network smoke. It verifies DNS resolution, certificate validity, HTTPS-only redirects, the public/Admin roots, and `/api/health/ready` including database and Redis readiness:

```powershell
npm.cmd run external:check:network
```

DNS/TLS deployment contract:

- Point `hands.vn` and `www.hands.vn` to the public TLS edge serving referral links.
- Point `api.hands.vn` to the same edge/API origin and preserve `/api/*` plus `/socket.io/*`.
- Point `admin.hands.vn` to the Admin Web origin. Do not route its Next.js `/api/admin/*` handlers to Nest.
- Provision a trusted certificate for every hostname before registering MoMo/VNPay production callbacks.
- Forward `Host` and `X-Forwarded-Proto: https` from the TLS edge to the Compose Nginx origin.
- Keep `VNPAY_GATEWAY_ENABLED=false` until the public callback, signed checkout, query recovery, and refund smoke all pass.

The repository cannot create registrar records or certificates without access to the PA Vietnam and hosting accounts. Those external changes remain fail-closed release blockers until `npm.cmd run external:check:network` passes.

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

After downloading the Firebase Admin private key JSON from the same Firebase project as the customer and Partner `google-services.json` files, install it outside Git with:

```powershell
npm.cmd run fcm:credentials:install -- -SourcePath C:\Users\<you>\Downloads\<firebase-admin-key>.json -CheckOnly
npm.cmd run fcm:credentials:install -- -SourcePath C:\Users\<you>\Downloads\<firebase-admin-key>.json -UpdateEnv
```

`fcm:push-smoke -- --dry-run` is config-only. `fcm:push-smoke -- --preflight` contacts the API but does not call retry or FCM. Run `npm.cmd run fcm:push-smoke` without either flag only after Firebase Admin credentials and either a real app FCM token or `FCM_SMOKE_USE_REGISTERED_DEVICE=true` for an enabled device from the selected role, phone, and platform are ready. The current registered-device live smoke should stay on non-payment notification candidates while payment gateway work remains last.
Partner alert notifications are controlled by `notification.partner_alert_channel`; when the default latest notification is a Partner alert intentionally routed to `IN_APP_ONLY`, the FCM smoke auto-selects a recent standard notification for the same role/phone when one exists, otherwise preflight reports the provider mismatch and suggests a standard notification id.
For Docker, the installer also writes `FIREBASE_ADMIN_CREDENTIALS_HOST_PATH`; `docker-compose.prod.yml` mounts that host file into the API container at `FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH` or `/run/secrets/firebase-admin.json`.

`google-services.json` belongs in the Android app folders as local client config only. It does not replace server-side Firebase Admin credentials for the NestJS API.

Payment gateway credentials are intentionally deferred until the 95% local-completeness gate and public HTTPS hosting are ready:

Referral store links are deferred until referral E2E. Public referral link clicks should only route to the correct customer or Partner app store URL by device platform; they must not call SMS, maps, push, payment, or wallet-credit APIs on click.

```dotenv
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_BASE_URL=https://test-payment.momo.vn
MOMO_IPN_URL=
MOMO_REDIRECT_URL=
MOMO_HTTP_TIMEOUT_MS=30000
MOMO_GATEWAY_ENABLED=false
VNPAY_GATEWAY_ENABLED=false
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_RETURN_URL=
VNPAY_SERVER_IP=
```

Keep `MOMO_GATEWAY_ENABLED=false` until signed sandbox checkout, IPN replay,
transaction-query recovery, capture/cancel, refund, and refund-query recovery all pass.
MoMo gateway calls enforce the provider's documented 30-second minimum timeout.

Keep `VNPAY_GATEWAY_ENABLED=false` until signed sandbox checkout, GET IPN,
status-query recovery, and asynchronous refund E2E all pass. VNPay must call a
public HTTPS `GET /api/payments/VNPAY/callback` endpoint; a localhost callback is
not provider-reachable.

## Production Notes

- `SUPABASE_SERVICE_ROLE_KEY`, payment secrets, SMS secrets, Firebase Admin private keys, S3 secrets, and Android keystore passwords must never be committed.
- If using `FIREBASE_SERVICE_ACCOUNT_JSON`, provide raw or base64 Firebase service account JSON with `project_id`, `client_email`, and `private_key`.
- If using `GOOGLE_APPLICATION_CREDENTIALS` for FCM, point it to an existing valid service account JSON file available to the API process or Docker container.
- Real Customer Phone Auth OTP verification and Nest API exchange passed against `hands-staging` on 2026-07-14. The same HANDS identity now has a preserved Customer profile plus an approved Partner profile, and Supabase `PROVIDER` app metadata sync passed. Final Partner OTP receive/verify and `/provider/me` remain blocked by the external Vietnam SMS sender route; keep production app login on the existing safe path until that last live gate passes.
- Use `PUSH_PROVIDER=in_app_only` for inbox-only local work; use `PUSH_PROVIDER=fcm` only during intentional FCM push E2E or staging rollout.
- Customers never carry negative wallet balances in MVP.
- Partner cash-fee debt can create a negative wallet and block final acceptance, service start, and payout release until settlement.
