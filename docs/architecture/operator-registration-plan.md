# HANDS Operator Registration Plan

This is the short operator order for HANDS-owned external accounts. Use `administration@hands.vn` and keep secrets outside Git.

## Identity

- Domain: `hands.vn`
- Admin email: `administration@hands.vn`
- DNS: PA Vietnam
- Public URL: `https://hands.vn`
- API URL: `https://api.hands.vn`
- Admin URL: `https://admin.hands.vn`
- GitHub: `hands-platform/hands-app`

## Registration Order

1. GitHub organization and repository
   - Status: connected.
   - Verify: `git remote -v`, `git push`.

2. Supabase staging
   - Status: `hands-staging` created and SQL applied.
   - Keep `AUTH_BACKEND=nest` until Phone Auth/SMS E2E passes.
   - Verify:

```powershell
npm.cmd run supabase:sql:pack
npm.cmd run external:check:supabase
npm.cmd run auth:supabase-smoke
```

3. MapTiler and Geoapify
   - Status: local/staging keys configured.
   - Purpose: low-cost map tiles and address search.
   - No Google Maps, Directions API, Routing API, or realtime route streaming in MVP.
   - Verify:

```powershell
npm.cmd run external:check:maps
```

4. Operations policy
   - Managed in Admin at `/operations-policy`.
   - Current defaults:
     - first-pick response window: 10 minutes
     - marketplace radius: 10km
     - marketplace location freshness: 30 minutes
     - final partner connection: first-pick valid acceptance first, otherwise customer fallback selection
     - negative partner wallet: marketplace participation blocked until settlement
   - Legacy env keys may still contain `BACKUP`; treat them as marketplace settings.

5. SMS/Phone Auth
   - Local mode: `SMS_PROVIDER=dev`, `DEV_OTP=123456`.
   - Next production-like path: Vonage Phone Auth/SMS E2E.
   - Do not enable Supabase Phone Auth for normal app testing until delivery is verified.

6. Push
   - Current: in-app notification records.
   - Future: OneSignal or equivalent backend adapter.
   - Keep REST API keys server-side only.

7. Payments
   - Current: Cash plus MoMo/VNPay placeholder adapters.
   - Needed later: MoMo/VNPay sandbox and merchant credentials.

8. Storage/CDN
   - Current: local MinIO.
   - Production candidates: Supabase Storage S3, Cloudflare R2, or another S3-compatible provider.
   - Private KYC files and public profile media must use separate access policies.

9. Android release signing
   - Helper: `npm.cmd run android:signing:create`.
   - Keystores must stay under `C:\dev\massage-vn-workspace\secrets`.

## Generated Handoff Pack

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run setup:doctor
npm.cmd run external:pack:write
```

Output:

```text
infra/setup/.generated/hands-external-registration-pack.md
```
