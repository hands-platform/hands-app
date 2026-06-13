# Partner Acceptance Operations

This document is the operating reference for the HANDS partner acceptance flow. It keeps the business policy, API enforcement, admin screens, and mobile behavior aligned while the UI design is still evolving.

## Product Rule

Customer booking starts from a selected partner profile. The selected partner is the preferred partner and receives the first response window.

Default operating policy:

- Preferred partner response window: 10 minutes.
- Marketplace partner radius: 10km from the confirmed booking address.
- Marketplace partners can participate while the preferred partner is still deciding.
- The preferred partner can become the matched partner by validly accepting first under API rules.
- Customer final partner selection is required when the preferred partner does not validly match first or the flow falls back to participant review.
- No automatic nearest-partner assignment.
- Matched bookings open chat immediately; service start keeps the matched chat available.
- Route calculation and live navigation APIs are not required for MVP.

## Partner Eligibility

A partner can accept or join only when the operational gates pass:

- Account is not blocked.
- KYC/verification is approved enough for active work.
- Location is available and inside the configured radius for marketplace matching.
- Partner is online or available soon.
- Partner offers the requested service and duration.
- Wallet is not negative for marketplace participation or payout release.
- Required app notification state is healthy enough for the selected notification policy.

The API remains the final guard. Mobile and admin UI warnings are advisory, but the API must reject unsafe finalization attempts.

## Cash Fee Debt

Cash bookings are collected directly by the partner. HANDS records platform fee, tax withholding, and configured costs against the partner wallet.

When that wallet becomes negative:

- The partner can still see marketplace opportunities so customer supply stays visible, but cannot join until settlement is confirmed.
- Marketplace requests can remain visible, but marketplace participation is blocked until settlement.
- Marketplace participation and customer final selection of that marketplace partner stay blocked until settlement.
- Payout release stays blocked until the debt is settled.
- The partner app displays the localized settlement-block message from `apps/provider_app/lib/src/features/earnings/presentation/provider_wallet_gate_helpers.dart`.
- Admin finance can settle the debt through cash settlement, earning, payout, payment, or booking detail workflows.
- Settlement must keep a reference or admin audit note.

This protects HANDS from accumulating unpaid platform fees without hiding marketplace supply too early.

## Tax Timing

Tax rules and fee rules must exist before revenue is created, but partner tax profile collection is deferred until the first earning.

Signup should stay light:

- Basic profile.
- Phone/auth.
- KYC and bank data needed for active work.

After first earning and before payout:

- Tax code/profile.
- Residential address.
- Payout and tax agreement versions.
- Any missing legal consent.

This lowers onboarding drop-off while keeping the finance system deterministic from day one.

## Admin Control Surfaces

Operators should use these screens together:

- `/operations-policy`: change response window, marketplace radius, marketplace-open mode, preferred accept mode, wallet gate, no-show, cancellation, and push policies.
- `/bookings?view=matching`: monitor live matching escalation, marketplace supply, customer final selection, and chat handoff.
- `/bookings/:id`: inspect one booking's policy snapshot, participants, alerts, finance trace, and audit trace.
- `/partners`: review partner acceptance blockers across wallet, account, location, push, KYC, and payout gates.
- `/partner-controls`: drill into unblock actions for debt, location, push, verification, tax, payout readiness, and saved report/sanction records.
- `/cash-settlements`, `/earnings`, `/payouts`, and `/payments`: confirm cash-fee debt cause, collect partner deposit or approve admin offset, record the settlement reference, and reopen marketplace/payout checks only after the wallet is no longer negative.
- `/tax-policy` and `/services`: manage tax, fee, service duration, minimum price, price step, and payout matrix policy.

## Acceptance Unblock Playbook

When a partner cannot join marketplace bookings or receive payout release, operators should resolve blockers in this order:

1. Clear negative wallet first.
   - Owner: Finance.
   - Why: cash bookings can create unpaid HANDS fee/tax debt.
   - Booking impact: marketplace requests can remain visible, but marketplace participation is blocked until settlement.
   - Payout impact: finance should not release payout while the partner still owes HANDS settlement.

2. Resolve account and sanction controls.
   - Owner: Trust.
   - Why: account blocks and active sanctions are intentional safety controls.
   - Booking impact: partner visibility and acceptance remain blocked while the restriction is active.
   - Payout impact: payout holds should stay until the report, sanction, or account review has a clean audit outcome.

3. Approve identity and bank readiness.
   - Owner: KYC.
   - Why: CCCD/selfie evidence and approved bank data are the Level 2 work gate for paid bookings.
   - Booking impact: paid work access and marketplace participation stay blocked until the evidence is approved.
   - Payout impact: bank approval is required before payout; tax profile remains staged until first earning.

4. Refresh stale partner location.
   - Owner: Dispatch.
   - Why: marketplace matching decisions depend on a recent stored partner location.
   - Booking impact: stale location can weaken marketplace matching or make distance ordering unreliable.
   - Payout impact: no direct payout impact, but location evidence may matter for disputes.

5. Confirm device and alert reachability.
   - Owner: Ops.
   - Why: partner response rate depends on recent app sessions, enabled devices, and FCM delivery health.
   - Booking impact: weak device state does not always hard-block acceptance, but it reduces response reliability.
   - Payout impact: no direct payout impact.

6. Keep tax as a post-first-earning payout gate.
   - Owner: Finance.
   - Why: tax policy must exist from day one, but tax profile collection should not increase signup friction before the first earning.
   - Booking impact: missing tax profile should not block first signup or first paid job.
   - Payout impact: after first earning, tax profile, tax address, and payout/tax agreements block payout or withdrawal until complete.

This order is mirrored in `/partner-controls` under `Marketplace and payout unblock playbook`.

## No-Show Closeout

No-show is an operational closeout state, not an automatic penalty in the MVP. It should be used only when a live booking cannot proceed because the customer or partner did not continue the service path.

Current MVP behavior:

- Eligible statuses: open matching, matched, partner on the way, or arrived.
- Admin must enter a reason when possible.
- The booking is moved to `NO_SHOW`.
- A payment-review ops task is blocked until support decides release, refund, capture, fee, or manual adjustment.
- The customer receives a `booking.no_show` notification.
- The selected partner, preferred partner, and marketplace participants receive a `booking.no_show` notification.
- The booking detail page shows no-show notification count in the booking alert trace.
- `/notifications?review=no-show` shows all customer and partner no-show communication rows.

Keep every no-show outcome as an admin closeout decision in the MVP. Operators should use arrival evidence, location evidence, chat history, and dispute context to decide payment release, refund, capture, fee, or manual wallet adjustment. If the policy later changes to stricter evidence-assisted admin review, the no-show policy snapshot must still be saved on each alert and audit row.

## Implementation Pointers

Backend enforcement:

- `apps/api/src/matching/matching.policy.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/provider-wallet/provider-wallet.policy.ts`

Admin visibility:

- `apps/admin_web/app/operations-policy/page.tsx`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/[id]/page.tsx`
- `apps/admin_web/app/notifications/page.tsx`
- `apps/admin_web/app/partners/page.tsx`
- `apps/admin_web/app/partner-controls/page.tsx`

Legacy `/providers` and `/providers/:id` pages redirect to canonical partner routes so older links keep working. New admin work should link to `/partners`, `/partners/:id`, or `/partner-controls`. Do not rebuild separate partner-risk pages; partner activity and account facts belong in the partner list and partner detail pages.

Partner mobile behavior:

- `apps/provider_app/lib/src/features/earnings/presentation/provider_wallet_gate_helpers.dart`
- `apps/provider_app/lib/src/features/booking/presentation/provider_marketplace_booking_card.dart`
- `apps/provider_app/test/provider_wallet_gate_test.dart`

Smoke coverage:

- `infra/scripts/api-smoke.mjs`
- `infra/scripts/admin-web-smoke.mjs`

## Open Operator Decisions

These should stay configurable instead of being hardcoded:

- Preferred partner response window.
- Marketplace partner radius.
- Whether marketplace partners can appear immediately or only after a delay.
- Whether preferred partner acceptance matched first or customer fallback selection was required.
- Marketplace list visibility is not retained as partner activity. The app should show settlement guidance before final acceptance or service start, and the API blocks marketplace final acceptance, customer final marketplace selection, service start, and payout release until settlement or approved offset clears the debt.
- No-show review thresholds and settlement decision options.
- Cash settlement deadline.
- Notification retry and fallback contact rules.
- Tax policy version, service-specific tax rules, and amount-band rules.

## Verification Checklist

Before changing this flow, run:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run api:smoke
node .\infra\scripts\admin-web-smoke.mjs
```

For mobile guard changes:

```powershell
cd C:\dev\massage-on-demand-vn\apps\provider_app
flutter test

cd C:\dev\massage-on-demand-vn\apps\customer_app
flutter test
```
