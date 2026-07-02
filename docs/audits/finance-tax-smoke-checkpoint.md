# Finance/Tax Smoke Checkpoint

Date: 2026-07-03

This checkpoint records the verified Finance/Tax work and the current commit-splitting risk. It is not a product behavior change.

## Verified Finance/Tax Scope

- Booking Settlement Audit detail now exposes settlement journal, payment clearing, and refund-after-payout reversal evidence.
- Payment Clearing detail now exposes source payment, linked settlement, and latest bank/journal match evidence.
- General Ledger detail now exposes source record, linked settlement, and bank reconciliation evidence.
- Bank Reconciliation detail now exposes matched finance source, payment clearing evidence, journal evidence, and unmatched remainder.
- Settlement Reversal detail exists and is included in Admin Web smoke coverage.
- Finance smoke data includes stable settlement, reversal, clearing, bank, and journal records.

## Verification Evidence

- `just local-stop; just local-start`
  - Restarted API/Admin without DB reset, migration, seed, or Docker volume changes.
  - API dist freshness returned to `fresh`.
- `npm.cmd run test --workspace @massage-vn/api -- admin.controller.spec.ts admin.service.spec.ts prisma-seed-contract.spec.ts`
  - Passed: 3 files, 345 tests.
- `npm.cmd run test --workspace @massage-vn/api -- settlements.service.spec.ts settlement-journal.spec.ts payments.service.spec.ts payment-refund-audit.spec.ts wallet-adjustments.accounting.spec.ts earnings.service.spec.ts earnings.policy.spec.ts api-smoke-contract.spec.ts`
  - Passed: 9 files, 117 tests.
- `npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/finance-detail-pages.spec.tsx app/finance-tax/finance-list-pages.spec.tsx app/finance-tax/finance-smoke-contract.spec.ts app/finance-tax/tax-settlement-page-model.spec.ts`
  - Passed: 4 files, 42 tests.
- `npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/tax-settlement-page-model.spec.ts app/finance-tax/finance-list-pages.spec.tsx`
  - Passed: 2 files, 35 tests.
- `npm.cmd run typecheck --workspace @massage-vn/api`
  - Passed.
- `npm.cmd run typecheck --workspace @massage-vn/admin-web`
  - Passed.
- `node infra/scripts/admin-web-smoke.mjs --budget /finance-tax/payment-clearing,/finance-tax/general-ledger,/finance-tax/bank-reconciliation --env=.env`
  - Passed.
- Full Finance smoke across list/detail pages passed. One settlement reversal detail was cold at about 3 seconds, but did not fail the smoke budget.
- Warm Finance list smoke stayed under 1 second per page after lowering the default Finance list page size to 10:
  - `/finance-tax/payment-clearing`: 679ms / 93KB
  - `/finance-tax/general-ledger`: 643ms / 95KB
  - `/finance-tax/bank-reconciliation`: 642ms / 106KB
  - `/finance-tax/booking-settlement-audit`: 773ms / 92KB
  - `/finance-tax/settlement-reversals`: 643ms / 96KB
  - `/finance-tax/coupon-finance`: 641ms / 96KB
- Warm Finance detail smoke stayed under 400ms for the sampled pages:
  - Payment Clearing detail: 337ms / 82KB
  - General Ledger detail: 323ms / 85KB
  - Bank Reconciliation detail: 358ms / 100KB
  - Booking Settlement Audit detail: 345ms / 87KB
  - Settlement Reversal detail: 340ms / 89KB
- Fresh API cold-ish Finance detail smoke after restart also passed:
  - Booking Settlement Audit detail: 2612ms / 88KB
  - Settlement Reversal detail: 2135ms / 89KB
  - Payment Clearing detail: 2066ms / 82KB
  - General Ledger detail: 1949ms / 85KB
  - Bank Reconciliation detail: 2347ms / 100KB
- `just status`
  - Docker services healthy.
  - API and Admin Web running.
  - API dist reported fresh.
- Commit `6aaeba73 perf(admin): reduce finance list default page size` was pushed to `origin/develop`.
- Commit `9afc2b68 docs(finance): record smoke checkpoint` was pushed to `origin/develop`.

## Do Not Commit Blindly

The current worktree has several unrelated work streams mixed together. Do not stage broad path groups until the mixed files below are reviewed.

### Mixed Files

- `apps/api/src/admin/admin.service.ts`
  - Contains Finance/Tax query and evidence changes.
  - Also contains Partner Overview request-event work using `providerBookingRequestEvent`.
- `apps/api/src/admin/admin.service.spec.ts`
  - Contains Finance/Tax tests.
  - Also contains Partner Overview request-event tests.
- `apps/admin_web/lib/admin-api.ts`
  - Contains Finance API response shape additions.
  - May also contain unrelated Admin Web API type additions from dashboard work.

### Non-Finance Changes Present

- Partner request-event schema and Provider App work:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20260702023000_add_provider_booking_request_events/`
  - `apps/provider_app/lib/src/features/booking/**`
  - `apps/provider_app/test/**`
- Map/Vietnam Overview work:
  - `apps/admin_web/package.json`
  - `package-lock.json`
  - `apps/admin_web/app/api/admin/maptiler-tiles/`
  - `apps/admin_web/app/api/admin/geoapify-tiles/[z]/[x]/[y]/route.ts`
  - `apps/admin_web/app/vietnam-overview/**`
- Usage/Partner/Finance Overview dashboard work:
  - `apps/admin_web/app/usage-overview/**`
  - `apps/admin_web/app/partners/overview/**`
  - `apps/admin_web/app/finance-overview/**`
- Calendar, coupons, admin operators, shell/navigation, and global atom styling changes are also present.

## Recommended Commit Split

1. `feat(finance): add settlement evidence detail flows`
   - Include Finance detail/list pages, Finance tests, Admin smoke markers, Admin API/controller Finance methods, seed smoke records, and finance-safe `admin-api.ts` changes.
   - Before committing, isolate Finance hunks from `admin.service.ts` and `admin.service.spec.ts`.

2. `feat(partners): record provider booking request events`
   - Include `ProviderBookingRequestEvent` schema/migration, Provider App view tracking, Partner Overview request-event query/test hunks, and related admin UI if any.

3. `feat(admin-map): add precise Vietnam operations map`
   - Include MapLibre/MapTiler dependencies, tile routes, and Vietnam Overview map files.

4. `feat(admin): add overview dashboards`
   - Include Usage Overview, Partner Overview, Finance Overview dashboard page/model/test files.

5. `style(admin): align Vuexy form/calendar/navigation atoms`
   - Include atom CSS/component changes, calendar/coupons/services/admin shell design work.

## Next Safe Step

The safest next engineering step is to split `admin.service.ts` and `admin.service.spec.ts` by ownership before committing. If that is too risky in this dirty worktree, keep the verified Finance work uncommitted and continue with page-level smoke fixes only.
