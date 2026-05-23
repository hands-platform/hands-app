# HANDS Environment Templates

Use these templates as operator-friendly checklists for local and staging setup.

## Staging Template

Start from:

```text
C:\dev\massage-vn-workspace\repo\infra\env\hands-staging.env.example
```

Copy values into your local `.env` when you receive real credentials from Supabase, MapTiler, Geoapify, MoMo, VNPay, storage/CDN, or a push provider.

Do not commit real `.env` files or secrets.

## Recommended Fill Order

1. Supabase project values
2. Supabase Phone Auth SMS configuration
3. MapTiler and Geoapify keys
4. MoMo and VNPay sandbox credentials
5. Storage/CDN credentials
6. OneSignal or another OS push provider

## Verification

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run setup:doctor
node infra\scripts\check-env.mjs infra\env\hands-staging.env.example --template
npm.cmd run external:check
npm.cmd run supabase:sql:pack
```

Run phase-specific checks when those credentials are ready:

```powershell
npm.cmd run external:check:supabase
npm.cmd run external:check:maps
npm.cmd run external:check:payments
npm.cmd run external:check:storage
npm.cmd run storage:smoke
```
