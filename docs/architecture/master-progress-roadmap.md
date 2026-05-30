# HANDS MVP Master Progress Roadmap

Last checked: 2026-05-30

This document is the single working map for HANDS MVP progress. It exists to keep backend, admin, mobile apps, external services, and product decisions from becoming fragmented.

## Product Direction

HANDS is a Vietnam-wide on-demand massage and service partner platform.

Core principles:

- Customer app, partner app, admin dashboard, and backend stay in one monorepo.
- Admin UI uses factual operations language. Avoid scoring customers or partners as risky people.
- Use "Partner" in admin/product language. Existing backend model names may still use `Provider` until a careful migration is planned.
- Chat opens after booking match/service start and is available to customer and partner during the active service flow.
- After service completion, mobile apps may hide the active chat, but admin keeps the full chat archive.
- First-earning tax collection is preferred. Do not force full tax information at initial signup.
- Cash booking platform fees can create negative partner wallet balance. Negative wallet blocks new booking acceptance until settlement.
- Design polish and full multilingual UI come after backend/admin/mobile flow stability.

## Current Technical Status

Checked commands:

- `npm.cmd run setup:doctor`: PASS
- `npm.cmd run security:secrets`: PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd run build --workspace @massage-vn/api`: PASS
- `npm.cmd run build --workspace @massage-vn/admin-web`: PASS
- `node infra/scripts/admin-web-smoke.mjs`: PASS, 53 admin pages
- `flutter analyze` in customer app: PASS
- `flutter test` in customer app: PASS, 10 tests
- `flutter analyze` in partner app: PASS
- `flutter test` in partner app: PASS, 58 tests
- `npm.cmd run external:check:maps`: PASS
- `npm.cmd run supabase:schema:check`: PASS, 38 required tables
- `npm.cmd run mobile:architecture:check`: PASS

Known environment note:

- Local API/Admin smoke tests require Docker PostgreSQL and Redis to be running.
- If `localhost:3100` or `localhost:3101` fails, run `docker compose up -d` and `npm.cmd run local:start`.

## Completed Foundations

Repository and environment:

- Canonical repo path: `C:\dev\massage-vn-workspace\repo`
- GitHub remote: `https://github.com/hands-platform/hands-app.git`
- Branch: `develop`
- Docker local services: PostgreSQL, Redis, MinIO
- Local commands: `local:start`, `local:stop`, `local:status`, `verify:local`
- Secret scan guard exists and currently passes.

Backend:

- NestJS API skeleton with Prisma.
- Core modules exist for auth, users, customers, providers, services, bookings, matching, chat, payments, notifications, files, locations, earnings, provider wallet, provider onboarding, admin.
- Prisma schema includes operational tables for booking, chat, payment, review, notification, files, provider verification, provider tax, wallet, payout, policy, and audit logging.
- Admin APIs cover bookings, customers, partners/providers, payments, refunds, reviews, notifications, payouts, services, tax policy, operations policy, cash settlements, app sessions, audit log, chat archive.

Admin dashboard:

- Operations dashboard with booking counts, matching wait, completion/cancel/no-show indicators, hourly and regional demand, active app users.
- Booking monitor with matching stages, first-pick, backup, customer choice, handoff repair, payment, cash debt, location, chat, closeout, expired, no-show views.
- Customer list and customer detail with activity, booking history, chat history, wallet/payment context, addresses, app sessions, notes, exports.
- Partner list and partner detail with KYC, bank, tax, services, booking records, chat records, devices, sessions, documents, wallet, payouts, controls.
- Services page with service groups, duration options, minimum price, price step, payout policy, fee/tax visibility.
- Tax policy page with versioned tax rules.
- Operations policy page for matching and wallet gates.
- Chat Archive page with filters, search, sender filter, date filter, CSV export, booking/customer/partner handoff links.
- CSV exports for customer/partner/account/chat operational records.

Customer mobile app:

- Flutter Clean Architecture structure exists.
- Firebase removed.
- Supabase imports are isolated outside presentation.
- Customer provider discovery, service selection, booking confirmation, location selection, map/search, chat, coupons, notifications scaffolds exist.
- MapTiler map and Geoapify search checks pass.

Partner mobile app:

- Flutter Clean Architecture structure exists.
- Firebase removed.
- Partner online/location update, direct request, backup request, wallet gate, service pricing, onboarding, KYC/bank/tax helpers, chat, earnings, verification scaffolds exist.
- Partner location heartbeat and wallet gate tests pass.

Supabase and external setup:

- Supabase project values are represented in local env without leaking into Git.
- Supabase generated SQL pack exists.
- Supabase schema alignment guard passes.
- MapTiler and Geoapify real checks pass.
- Firebase removal guard passes.

## Deferred External Integrations

These are intentionally not blockers for local MVP development:

- Vonage/Supabase Phone Auth production SMS.
- OneSignal production push credentials.
- MoMo merchant credentials.
- VNPay merchant credentials.
- Production S3/R2 storage credentials.
- App Store / Play Store release accounts and final signing validation.

Rule: Do not let these block admin/backend/mobile local flow work. Keep them visible in setup docs and checks.

## Current Fragmentation Risks

The codebase is healthy, but the work can become fragmented in these areas:

- Admin pages are broad. Each page must have a clear operational purpose and link back to booking/customer/partner context.
- Product language is transitioning from Provider to Partner. Admin text should use Partner, but DB/API rename should be delayed until a dedicated migration.
- External services are partly configured. Local development should not rely on production credentials.
- Mobile UI has working flows, but design is intentionally temporary.
- Policies for matching, cash fee debt, tax, payout, and service pricing must stay admin-configurable, not hardcoded in apps.

## Recommended Build Order From Here

### Phase A: Stabilize Admin Operating Core

Goal: Admin staff can understand and control the business without needing database access.

1. Customer detail completeness
   - Ensure customer detail shows bookings, completed work count, last completed booking, payments/refunds, wallet, saved addresses, chat archive, app sessions, admin notes.
   - Avoid customer scoring. Show factual activity only.

2. Partner detail completeness
   - Keep partner list as the primary entry point.
   - Detail page should contain onboarding/KYC/bank/tax, services/pricing, booking history, chat records, wallet/cash debt, payouts, documents, sessions/devices, notes, controls.
   - Avoid separate Partner Activity as a primary concept unless it is only an internal section.

3. Booking detail as source of truth
   - Every booking should show service option, customer, selected/preferred partner, participants, matching timeline, chat archive, payment, wallet, tax, refund, location, admin notes.

4. Operations policy controls
   - Confirm admin can update matching window, 10km participation radius, wallet negative balance gate, no-response handling, backup participation window.

5. Setup page as operational checklist
   - Show external integration readiness and what is deferred.

### Phase B: Backend Rule Consistency

Goal: Mobile apps and admin use the same policy logic.

1. Matching policy service
   - Partner first-response window: 10 minutes.
   - Backup participation radius: default 10km.
   - Eligible nearby partners get notification/in-app request.
   - Customer can select among available partners.

2. Wallet/cash debt gate
   - Cash booking fee debt creates negative wallet.
   - Negative wallet blocks partner booking acceptance.
   - Admin can see and settle fee debt.

3. Service pricing engine
   - Admin creates service name.
   - Admin creates duration options: 60, 90, 120, etc.
   - Admin sets minimum price and step, default 100,000 VND step.
   - Partner can set equal or higher price.
   - Admin sets payout rule per service duration/price.
   - Finance views show customer price, partner payout, platform fee, VAT/withholding/other costs, net company fee.

4. Tax and payout engine
   - Tax rules versioned by effective date.
   - First revenue triggers tax-info collection before payout.
   - Tax and withholding logs are generated per completed booking/payout.

### Phase C: Mobile E2E Flow

Goal: Customer and partner apps can run the whole local operational flow.

1. Customer
   - Choose location.
   - See nearby partners sorted by distance/availability.
   - Open partner detail.
   - Choose service and duration.
   - Book now.
   - Wait for preferred partner and backup partners.
   - Select partner if backups join.
   - Chat after match/service start.

2. Partner
   - Go online and send current location.
   - Receive direct request.
   - See open backup requests within policy radius.
   - Join backup request.
   - Accept direct or selected request.
   - Start service to unlock chat.
   - Complete service.
   - See earnings/wallet/cash debt state.

### Phase D: External Production Readiness

Goal: Replace local/dev behavior with production services.

1. Supabase Auth with Vonage phone OTP.
2. Supabase Storage or S3/R2 bucket policy.
3. OneSignal push E2E.
4. MoMo/VNPay sandbox payment E2E.
5. Production domain, DNS, SSL, and deployment.

### Phase E: Design and Localization

Goal: Apply final Figma style and multilingual UX after flows stop shifting.

1. Apply final customer app design.
2. Apply final partner app design.
3. Admin UI polish for operators.
4. Customer languages: Vietnamese, English, Korean, Chinese, Japanese.
5. Partner app language: Vietnamese first.
6. Admin language: Korean, Vietnamese, English as needed.

## Immediate Next Work

The next safest implementation order is:

1. Tighten customer and partner detail pages around factual activity and chat history.
2. Make booking detail the strongest cross-linking source of truth.
3. Review operations policy page and ensure the 10-minute/10km matching policy is both visible and API-backed.
4. Add any missing backend tests for matching policy and wallet gate.
5. Then return to mobile E2E screens.

## Definition Of Done For Each Small Step

Every step should finish with:

- Code changed in a narrow scope.
- Typecheck passes.
- Relevant build passes.
- Relevant smoke/test passes.
- No secret leaks.
- Git commit pushed to `develop`.
- This roadmap updated if status or priority changes.
