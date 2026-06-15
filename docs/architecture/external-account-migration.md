# HANDS External Account Migration

Use this file when moving external services to clean HANDS-owned accounts under `administration@hands.vn`.

## Rule

- Prefer new HANDS-owned accounts instead of migrating old personal credentials.
- Enable 2FA where available.
- Store recovery codes and secrets outside Git under `C:\dev\hands-secrets`.
- Do not commit API keys, passwords, merchant secrets, service-role keys, private keys, or recovery codes.
- Revoke old personal/dev keys only after the new HANDS-owned values pass E2E.

## Current Account State

| Service    | Status                                                                                                    | Next action                                              |
| ---------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Domain/DNS | `hands.vn` managed through PA Vietnam                                                                     | Add production DNS when deployment starts                |
| Email      | `administration@hands.vn` can receive mail                                                                | Use as owner/admin email                                 |
| GitHub     | `hands-platform/hands-app` connected                                                                      | Keep `develop` pushed                                    |
| Supabase   | `hands-staging` created, SQL applied, storage buckets verified, Phone Auth send smoke reached test device | Capture OTP and finish verify/API exchange smoke         |
| MapTiler   | HANDS-owned key configured locally                                                                        | Add restrictions later if needed                         |
| Geoapify   | HANDS-owned key configured locally                                                                        | Add restrictions later if needed                         |
| Push       | FCM credentials installed and registered-device live smoke sent a non-payment notification                | Keep rollout gated by audit evidence and token freshness |
| Storage    | Local MinIO active                                                                                        | Supabase Storage S3/R2 decision later                    |
| SMS        | Vonage credentials usable for current Phone Auth OTP send path                                            | SMS sender-channel refinement deferred                   |
| Payments   | Cash active, adapters exist                                                                               | MoMo/VNPay sandbox credentials last                      |

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
