# HANDS External Setup Checklist

Use this checklist only for external console readiness. Keep real secrets outside Git under:

```text
C:\dev\massage-vn-workspace\secrets
```

Canonical operator order:

- `docs/architecture/operator-registration-plan.md`
- `infra/env/hands-staging.env.example`
- `infra/setup/.generated/hands-external-registration-pack.md`

## Business Identity

- App: `HANDS`
- Domain: `hands.vn`
- Admin email: `administration@hands.vn`
- DNS: PA Vietnam
- GitHub: `hands-platform/hands-app`
- Service area: Vietnam

## Current Status

| Area | Status | Next action |
| --- | --- | --- |
| GitHub | Connected to HANDS org repo | Keep pushing `develop` |
| Supabase | Staging project created and SQL applied | Phone Auth/SMS E2E deferred |
| MapTiler | Local/staging key configured | Keep key out of Git |
| Geoapify | Local/staging key configured | Keep key out of Git |
| Firebase | Removed from Flutter apps | Do not reintroduce config files |
| Push | In-app notifications active | OneSignal or equivalent later |
| SMS | Dev OTP active | Vonage Phone Auth/SMS E2E later |
| Payments | Cash active, MoMo/VNPay adapters exist | Merchant sandbox credentials later |
| Storage | Local MinIO works | Supabase Storage S3/R2 production choice later |
| Android signing | Local helper ready | Production keystores stay in secrets folder |

## Required Env Groups

```dotenv
APP_DOMAIN=hands.vn
PUBLIC_WEB_URL=https://hands.vn
API_PUBLIC_URL=https://api.hands.vn
ADMIN_PUBLIC_URL=https://admin.hands.vn
ADMIN_EMAIL=administration@hands.vn
SUPPORT_EMAIL=administration@hands.vn
```

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
PUSH_PROVIDER=in_app_only
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

```dotenv
SMS_PROVIDER=dev
DEV_OTP=123456
```

```dotenv
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
```

## Verification Commands

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run setup:doctor
npm.cmd run external:check
npm.cmd run external:check:maps
npm.cmd run security:secrets
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

## Production Notes

- `SUPABASE_SERVICE_ROLE_KEY`, payment secrets, SMS secrets, OneSignal REST keys, S3 secrets, and Android keystore passwords must never be committed.
- Keep `AUTH_BACKEND=nest` until production SMS OTP is verified.
- Keep `PUSH_PROVIDER=in_app_only` until OS-level push E2E is intentionally tested.
- Customers never carry negative wallet balances in MVP.
- Partner cash-fee debt can create a negative wallet and block final acceptance, service start, and payout release until settlement.
