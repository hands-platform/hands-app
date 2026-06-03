# HANDS MVP Master Progress Roadmap

Last checked: 2026-06-03

This is the short working map for the MVP. If this file conflicts with `docs/architecture/hands-mvp-final-authority.md`, the final authority file wins.

## Product Authority Snapshot

- HANDS is an address-based, profile-first, on-demand partner marketplace for Vietnam.
- Supabase is infrastructure; NestJS is the business authority.
- Booking creation requires an immutable `BookingAddressSnapshot`.
- First-pick partner response window is 10 minutes by default.
- Marketplace participation uses booking-address distance, 10km by default.
- Customer always selects the final partner. No automatic assignment.
- No scheduled booking, tip, gratuity, VIP, or people-scoring system in MVP.
- Partner negative wallet blocks marketplace participation and downstream booking gates until settlement.
- Admin is an Operations Command Center, not CRM.
- Visible product/admin copy should say Partner. Internal DB/API names may still use Provider.

## Current Technical Baseline

Known passing checks:

```powershell
npm.cmd run setup:doctor
npm.cmd run authority:check
npm.cmd run api:policy-coverage
npm.cmd run api:domain-smoke
npm.cmd run security:secrets
npm.cmd run typecheck
npm.cmd run build --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run mobile:architecture:check
npm.cmd run mobile:visible-copy
flutter analyze .\apps\customer_app
flutter analyze .\apps\provider_app
```

Full local smoke needs Docker PostgreSQL and Redis:

```powershell
docker compose up -d
npm.cmd run local:start
node infra/scripts/api-smoke.mjs
node infra/scripts/admin-web-smoke.mjs
```

## Completed Foundations

- Monorepo structure for API, Admin Web, Customer App, Partner App, packages, infra, and docs.
- Firebase removed from Flutter apps.
- Supabase staging schema and RLS bundle prepared/applied.
- MapTiler and Geoapify local map/search path verified.
- NestJS API modules cover auth, customers, partners/providers, bookings, matching, chat, payments, refunds, notifications, files, locations, earnings, wallet, onboarding, policy, and admin.
- Admin covers dashboard, bookings, customers, partners, services, tax policy, operations policy, payments, refunds, earnings, payouts, cash settlements, notifications, chat archive, app sessions, audit, and setup.
- Customer and partner apps have functional MVP scaffolds for address, discovery, booking, matching, chat, location, earnings, and onboarding.
- Smoke guards protect final authority, no-tip surface, Partner visible copy, address snapshot, marketplace radius, first-pick window, customer final selection, wallet debt, settlement, and admin factual records.

## Current Work Order

1. Admin operating depth
   - Keep dashboard, bookings, customers, partners, marketplace, wallet, cash settlement, payout, tax, chat archive, and audit easy to inspect.
   - Use factual records only; do not score or rank customers/partners.

2. Backend rule consistency
   - Keep matching, wallet, service pricing, tax, payout, and closure policy in API services.
   - Keep operations policy admin-configurable.

3. Mobile E2E
   - Customer: address -> partner list -> partner detail -> service/duration -> booking -> matching -> final selection -> chat.
   - Partner: online/location -> direct request -> marketplace list -> join/accept -> start -> chat -> complete -> earnings/wallet.

4. External production readiness
   - Vonage/Supabase Phone Auth E2E.
   - OneSignal or equivalent push E2E.
   - MoMo/VNPay sandbox E2E.
   - Production storage/CDN.
   - DNS, TLS, deployment, release signing.

5. Final design and localization
   - Apply final Figma styling after backend/admin/mobile flows stop shifting.
   - Customer languages later: Vietnamese, English, Korean, Chinese, Japanese.
   - Partner language later: Vietnamese first.
   - Admin languages later: Korean, Vietnamese, English.

## Definition Of Done

Every stable step should end with:

- Narrow code/doc scope.
- Relevant typecheck/build/test/smoke pass.
- Secret scan pass.
- Commit pushed to `develop`.
- This roadmap updated only when status or work order changes.
