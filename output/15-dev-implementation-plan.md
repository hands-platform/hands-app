# Development Implementation Plan

This plan follows the current HANDS MVP authority. Keep changes small, verified, and commit-ready.

## Current Priority

1. Keep docs, API policy, Admin, and mobile screens aligned with final MVP authority.
2. Preserve existing working local environment and smoke tests.
3. Build operational depth in Admin before final visual design.
4. Keep mobile UI functional and understandable, then apply final design later.

## Phase A - Authority and Safety

- Guard no-tip, no-VIP, no-people-scoring visible copy.
- Guard address snapshot booking creation.
- Guard marketplace radius and first-pick window behavior.
- Guard partner negative-wallet marketplace participation block.
- Keep Admin visible copy as Partner.

## Phase B - Admin Operations Command Center

- Dashboard metrics for bookings, marketplace, completion, cancellations, no-show decisions, regional demand, hourly demand, customer sessions, online partners, payout/debt.
- Customer list/detail with factual activity, bookings, payments, refunds, chats, addresses, sessions, and notes.
- Partner list/detail with onboarding, KYC, bank, tax, services, location, bookings, chats, earnings, wallet, payouts, documents, and notes.
- Marketplace booking detail with participant ledger and final-selection trace.
- Operations policy page for runtime matching and gate settings.

## Phase C - Backend Business Rules

- Booking address snapshot required.
- Direct first-pick request plus marketplace candidate participation.
- Customer final selection only.
- Cash fee debt ledger and settlement gate.
- Service duration options and admin-managed payout rules.
- Tax/fee policy snapshots.

## Phase D - Mobile Functional MVP

- Customer address selection and partner browse/detail/booking/matching/chat.
- Partner online/location/request/marketplace/chat/complete/earnings.
- Repository/use-case separation for future Supabase adapter swaps.
- No direct business writes to Supabase from screens.

## Phase E - External Services

- Supabase Auth Phone OTP after SMS provider is configured.
- Supabase Storage migration for documents/media.
- OneSignal or another push adapter after in-app notification flow is stable.
- MoMo/VNPay sandbox E2E.
- Production storage/CDN.

## Verification

Run these before each stable commit when relevant:

```powershell
npm.cmd run authority:check
npm.cmd run mobile:visible-copy
npm.cmd run security:secrets
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
flutter analyze .\apps\customer_app
flutter analyze .\apps\provider_app
```
