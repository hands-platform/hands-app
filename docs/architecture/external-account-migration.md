# HANDS External Account Migration

Use this file when moving external services to clean HANDS-owned accounts under `administration@hands.vn`.

## Rule

- Prefer new HANDS-owned accounts instead of migrating old personal credentials.
- Enable 2FA where available.
- Store recovery codes and secrets outside Git under `C:\dev\hands-secrets`.
- Do not commit API keys, passwords, merchant secrets, service-role keys, private keys, or recovery codes.
- Revoke old personal/dev keys only after the new HANDS-owned values pass E2E.

## Current Account State

| Service | Status | Next action |
| --- | --- | --- |
| Domain/DNS | `hands.vn` managed through PA Vietnam | Add production DNS when deployment starts |
| Email | `administration@hands.vn` can receive mail | Use as owner/admin email |
| GitHub | `hands-platform/hands-app` connected | Keep `develop` pushed |
| Supabase | `hands-staging` created, SQL applied, storage buckets verified | Phone Auth/SMS E2E later |
| MapTiler | HANDS-owned key configured locally | Add restrictions later if needed |
| Geoapify | HANDS-owned key configured locally | Add restrictions later if needed |
| Push | In-app mode active | OneSignal or equivalent later |
| Storage | Local MinIO active | Supabase Storage S3/R2 decision later |
| Payments | Cash active, adapters exist | MoMo/VNPay sandbox credentials later |
| SMS | Dev OTP active | Vonage Phone Auth/SMS E2E later |

## Verification

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run setup:doctor
npm.cmd run external:check
npm.cmd run security:secrets
```

## Remote

```powershell
git remote set-url origin https://github.com/hands-platform/hands-app.git
git push -u origin develop
```
