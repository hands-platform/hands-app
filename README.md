# HANDS Vietnam MVP

Original MVP for HANDS, a realtime on-demand massage marketplace serving all of Vietnam.

## Documentation Start Point

Read `docs/README.md` first. It explains which documents are authoritative, which files are product planning snapshots, and which files are historical reference only.

## Current MVP Contract

- Supabase is infrastructure; NestJS owns business rules, authorization, booking state, matching, payments, settlement, and audit decisions.
- Customer discovery is address-based. Customers may browse partners from any country, but booking creation requires a confirmed HANDS service address.
- Every booking stores an immutable `BookingAddressSnapshot`.
- First-pick partner response window is 10 minutes.
- Marketplace partners can participate only when they are eligible within the configured booking-address radius, currently 10km by default.
- Customers always select the final partner. There is no automatic assignment.
- MVP bookings are immediate/on-demand. Scheduled booking and calendar booking UX are not exposed.
- Tips, gratuity, VIP, people scoring, and ranking programs are not part of the MVP.
- Customer cancellation after direct matching is not a normal app action in MVP. Cancellation and no-show outcomes are admin decisions based on chat/evidence.
- Partner negative wallet balances do not affect customers. Partners may see marketplace requests, but marketplace participation and payout release are blocked until settlement.
- Admin is an Operations Command Center, not a CRM.
- Internal code may still use `Provider` names for compatibility. Visible product and admin copy should say `Partner`.
- HANDS business time uses the canonical IANA timezone `Asia/Ho_Chi_Minh` (`ICT`, `UTC+7`) across UI, API, tests, audit evidence, and documentation; equivalent UTC offsets do not make other region identifiers interchangeable.

## Apps

- `apps/customer_app` - Flutter customer app.
- `apps/provider_app` - Flutter partner app.
- `apps/admin_web` - Next.js admin dashboard.
- `apps/api` - NestJS API, realtime gateway, matching, payments, jobs.

## Packages

- `packages/shared-types` - Cross-app domain enums and DTO contracts.
- `packages/shared-ui` - Placeholder for future shared web UI conventions.
- `packages/config` - Shared lint/format/config presets.

## Infrastructure

- PostgreSQL + PostGIS
- Redis for realtime session state and queues
- S3-compatible storage or Cloudflare R2
- Nginx reverse proxy

## Development

Primary local workspace:

```powershell
cd C:\dev\massage-on-demand-vn
```

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
docker compose up -d
```

Local storage uses MinIO. The compose file creates the `massage-vn` bucket automatically; `.env.example` points S3-compatible settings at that local bucket.

Seed and smoke test after Docker is running:

```powershell
$env:DATABASE_URL='postgresql://massage:massage@localhost:5432/massage_vn?schema=public'
npm.cmd run prisma:migrate --workspace @massage-vn/api
npm.cmd run prisma:seed --workspace @massage-vn/api
npm.cmd run dev --workspace @massage-vn/api
npm.cmd run api:smoke
```

Health checks:

```powershell
Invoke-RestMethod http://localhost:3100/api/health
Invoke-RestMethod http://localhost:3100/api/health/ready
```

Environment check:

```powershell
node infra/scripts/check-env.mjs .env.example
```

Development tool check:

```powershell
.\infra\scripts\check-dev-env.ps1
```

If PowerShell execution policy blocks local scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\check-dev-env.ps1
```

Full local verification:

```powershell
npm.cmd run verify:local
```

Fast scoped verification during development:

```powershell
npm.cmd run verify:admin:fast
npm.cmd run verify:api:fast
npm.cmd run verify:provider:fast
npm.cmd run verify:customer:fast
```

Use scoped verification for isolated work, then run full verification before protected API, DB, payment, wallet, booking, matching, or release chunks.

Mobile Firebase removal check:

```powershell
node infra/scripts/check-mobile-firebase.mjs
```

After Docker Desktop is installed and running:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

If the standard HANDS local API is already running on `http://localhost:3100/api`, the verification script now reuses that runtime for smoke checks instead of starting a second temporary API.

Current HANDS local workspace layout:

- `C:\dev\massage-on-demand-vn`
- `C:\dev\hands-secrets` for credentials and recovery codes outside Git
- `C:\dev\hands-references\apk` for reference APK files
- `C:\dev\hands-references\analysis` for reference analysis output

HANDS local API/Admin startup on non-conflicting ports:

```powershell
npm.cmd run local:start
npm.cmd run local:status
npm.cmd run local:stop
```

Default local URLs:

- API: `http://localhost:3100/api/health`
- Admin: `http://localhost:3101`

External operator setup:

```powershell
npm.cmd run setup:doctor
npm.cmd run external:pack:write
```

Use this operator order when registering Supabase, MapTiler, Geoapify, MoMo, VNPay, Firebase Cloud Messaging, SMS, storage, and Android release values:

- `docs/architecture/operator-registration-plan.md`
- `infra/setup/.generated/hands-external-registration-pack.md`
- `infra/supabase/.generated/hands-staging-setup.sql`

Android Emulator run:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App customer
powershell -ExecutionPolicy Bypass -File .\infra\scripts\run-hands-emulator.ps1 -App provider
```

HANDS uses Firebase Cloud Messaging for Android/iOS FCM push only. Firebase Realtime Database, Firestore, Firebase Auth, and Firebase Storage are not part of the MVP.

If Git, Docker, or Flutter are missing, open PowerShell as Administrator and run:

```powershell
.\infra\scripts\check-dev-env.ps1 -Install
```

Dedicated installer for Git, Docker Desktop, and Flutter:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\install-dev-tools-admin.ps1
```

The smoke script covers demo OTP login, partner verification file presign/read-url, admin verification approval, booking creation, partner marketplace participation, customer selection, chat, completion, review/feedback, partner earnings, payout batch creation, admin refund, and notification reads.

This repository is structured for small, commit-ready phases. Phase 1 includes reports, architecture docs, Docker, Prisma schema, backend skeleton, and starter mobile/admin UI.

## Mobile MVP

Customer and partner apps now have runtime API clients, phone OTP request/verify screens, demo OTP login, Bearer-token REST calls, and Socket.IO JWT handshake setup. See:

- `docs/architecture/mobile-api-integration.md`
- `docs/architecture/localization-strategy.md`

## Product Direction

The current MVP intentionally follows the reference app's flow order while keeping the implementation original. See:

- `docs/architecture/master-progress-roadmap.md`
- `docs/architecture/product-intent.md`
- `docs/architecture/partner-acceptance-operations.md`

## Admin MVP

Admin Web now reads protected admin APIs from server components and falls back to empty states when the API is unavailable. See:

- `docs/architecture/admin-web-integration.md`

## Payments MVP

MoMo, VNPay, and Cash are wired behind placeholder adapters with callback routes and status-check jobs. See:

- `docs/architecture/payments.md`

## Reviews MVP

Completed bookings can keep factual customer feedback records for service recovery and operator review. The MVP does not use feedback as a customer or partner score, ranking, dispatch priority, VIP status, or automatic account decision. See:

- `docs/architecture/reviews.md`

## CI

GitHub Actions checks Prisma, API, Admin Web, and script syntax on `main`, `develop`, and pull requests. See:

- `docs/architecture/ci-cd.md`

## Deployment

Nginx routing and environment validation notes are documented in:

- `docs/architecture/deployment.md`
- `docs/architecture/dev-environment.md`
- `docs/architecture/backup-restore.md`
- `docs/architecture/observability.md`
- `docs/architecture/external-setup-checklist.md`
- `docs/architecture/operator-registration-plan.md`

Production-style compose:

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

Scripted deployment flow:

```powershell
.\infra\scripts\deploy-prod.ps1
```

```bash
sh infra/scripts/deploy-prod.sh
```
