# HANDS External Account Migration

All external services should be owned by the HANDS business identity:

- Domain: `hands.vn`
- Operator/admin email: `administration@hands.vn`
- Public web URL: `https://hands.vn`
- API URL: `https://api.hands.vn`
- Admin URL: `https://admin.hands.vn`

Use this file when moving from the current personal/dev accounts to the final HANDS-owned accounts. Do not commit passwords, API keys, recovery codes, service role keys, merchant secrets, or private keys.

## Migration Rule

Clean-account policy:

- Prefer creating new HANDS-owned accounts under `administration@hands.vn`.
- Do not migrate old personal API keys, service role keys, tokens, or merchant secrets.
- Use old accounts only as temporary references until the new account passes verification.
- Revoke old personal/dev keys only after the new values pass E2E.

For every external service:

1. Create a new account, organization, project, or app under `administration@hands.vn`.
2. Enable two-factor authentication.
3. Store recovery codes and secrets outside Git under `C:\dev\massage-vn-workspace\secrets`.
4. Create new API keys from the new account.
5. Put only env variable names and non-secret identifiers in Git.
6. Update local `.env` with real values.
7. Run the matching verification command.
8. After verification, remove old personal/dev credentials from local machines and provider consoles.

## Account Transfer Order

### 1. Domain, DNS, And Email

Current status:

- Registrar: PA Vietnam, `https://www.pavietnam.vn`
- DNS provider: PA Vietnam direct DNS management
- DNS permission: operator can add and delete DNS records directly
- Operator inbox: `administration@hands.vn` is active and can receive email

Planned DNS records later:

- `hands.vn` for public web/app landing
- `api.hands.vn` for backend API
- `admin.hands.vn` for admin dashboard
- email SPF/DKIM/DMARC records for `hands.vn`

### 2. GitHub

Current plan:

- Account type: GitHub Organization
- Organization owner/name: `hands-platform`
- Repository: `hands-app`
- Repository URL: `https://github.com/hands-platform/hands-app`
- Organization should be created and controlled by `administration@hands.vn`

Current dev remote can stay until the new repository exists. After migration:

```powershell
cd C:\dev\massage-vn-workspace\repo
git remote set-url origin https://github.com/hands-platform/hands-app.git
git push -u origin develop
```

### 3. Supabase

Current project:

- Project name: `hands-staging`
- Project URL: `https://adzpstrkpzwpukuboxzj.supabase.co`
- SQL bundle applied successfully
- PostgREST role grant patch applied successfully
- Remote REST table access verified with service role
- Storage buckets verified: `hands-public`, `hands-private`
- Supabase JWT secret verified against the anon token
- Local API Supabase auth smoke test passed
- Phone Auth/SMS setup deferred
- Planned SMS provider for Supabase Phone Auth: Vonage

Need from operator:

- Vonage credentials when Phone Auth E2E starts
- confirmation that Phone Auth is enabled after Vonage is configured

Verification:

```powershell
npm.cmd run supabase:sql:pack
npm.cmd run external:check:supabase
npm.cmd run auth:supabase-smoke
```

### 4. MapTiler

Need from operator:

- MapTiler API key created under `administration@hands.vn`
- Any allowed domain/package restrictions configured in MapTiler, if used

Verification:

```powershell
npm.cmd run external:check:maps
```

### 5. Geoapify

Need from operator:

- Geoapify API key created under `administration@hands.vn`
- Any allowed domain/package restrictions configured in Geoapify, if used

Verification:

```powershell
npm.cmd run external:check:maps
```

### 6. OneSignal Or Push Provider

Need from operator:

- OneSignal App ID
- OneSignal REST API key
- Android/iOS app setup confirmation when mobile push E2E starts

Keep `PUSH_PROVIDER=in_app_only` until push E2E is intentionally tested.

### 7. Storage

Need from operator:

- Final storage provider choice: Supabase Storage S3, Cloudflare R2, or another S3-compatible provider
- endpoint
- region
- bucket
- access key
- secret key
- public CDN/base URL

Verification:

```powershell
npm.cmd run external:check:storage
```

### 8. Payments

Need from operator:

- MoMo sandbox merchant credentials
- VNPay sandbox merchant credentials
- callback/return URL requirements from each gateway
- legal merchant account owner details

Planned callback domains:

- `https://api.hands.vn/api/payments/momo/callback`
- `https://api.hands.vn/api/payments/vnpay/callback`

### 9. SMS

Planned provider: Vonage.

Phone Auth/SMS E2E is intentionally deferred. Keep local auth on `AUTH_BACKEND=nest` and `SMS_PROVIDER=dev` until Vonage credentials are ready and OTP delivery is tested.

Need from operator:

- API URL
- API key
- sender ID rules for `HANDS`

## Current Prompt Sequence

I will request values one service at a time. Start with domain/email/DNS, then GitHub, then Supabase, then maps/geocoding, then storage, push, payments, and SMS.
