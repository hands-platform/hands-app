# Partner Acceptance Operations

This document is the operating reference for the HANDS partner acceptance flow. It keeps the business policy, API enforcement, admin screens, and mobile behavior aligned while the UI design is still evolving.

## Product Rule

Customer booking starts from a selected partner profile. The selected partner is the preferred partner and receives the first response window.

Default operating policy:

- Preferred partner response window: 10 minutes.
- Backup partner radius: 10km from the booking location.
- Backup partners can join while the preferred partner is still deciding.
- Customers always choose the final partner.
- No automatic final matching.
- Service start unlocks the active chat workflow.
- Route calculation and live navigation APIs are not required for MVP.

## Partner Eligibility

A partner can accept or join only when the operational gates pass:

- Account is not blocked.
- KYC/verification is approved enough for active work.
- Location is available and inside the configured radius for backup matching.
- Partner is online or available soon.
- Partner offers the requested service and duration.
- Wallet is not negative unless an explicit recovery policy allows one active recovery booking.
- Required app notification state is healthy enough for the selected notification policy.

The API remains the final guard. Mobile and admin UI warnings are advisory, but the API must reject unsafe acceptance attempts.

## Cash Fee Debt

Cash bookings are collected directly by the partner. HANDS records platform fee, tax withholding, and configured costs against the partner wallet.

When that wallet becomes negative:

- The partner cannot accept new direct requests.
- The partner cannot join open backup matching.
- The partner app displays the localized settlement-block message from `apps/provider_app/lib/main.dart`.
- Admin finance can settle the debt through cash settlement, earning, payout, payment, or booking detail workflows.
- Settlement must keep a reference or admin audit note.

This protects HANDS from accumulating unpaid platform fees while still allowing cash payment as a low-friction Vietnam payment method.

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

- `/operations-policy`: change response window, backup radius, backup-open mode, preferred accept mode, wallet gate, no-show, cancellation, and push policies.
- `/bookings?view=matching`: monitor live matching escalation, backup supply, customer final selection, and chat handoff.
- `/bookings/:id`: inspect one booking's policy snapshot, participants, alerts, finance trace, and audit trace.
- `/partners`: review partner acceptance blockers across wallet, account, location, push, KYC, and payout gates.
- `/partner-controls`: drill into unblock actions for debt, location, push, verification, tax, payout readiness, and saved report/sanction records.
- `/cash-settlements`, `/earnings`, `/payouts`, and `/payments`: settle or offset cash fee debt.
- `/tax-policy` and `/services`: manage tax, fee, service duration, minimum price, price step, and payout matrix policy.

## Acceptance Unblock Playbook

When a partner cannot accept a direct request or join backup matching, operators should resolve blockers in this order:

1. Clear negative wallet first.
   - Owner: Finance.
   - Why: cash bookings can create unpaid HANDS fee/tax debt.
   - Booking impact: direct acceptance and backup joining stay blocked until the debt is settled, offset, or explicitly recovered.
   - Payout impact: finance should not release payout while the partner still owes HANDS settlement.

2. Resolve account and sanction controls.
   - Owner: Trust.
   - Why: account blocks and active sanctions are intentional safety controls.
   - Booking impact: partner visibility and acceptance remain blocked while the restriction is active.
   - Payout impact: payout holds should stay until the report, sanction, or account review has a clean audit outcome.

3. Approve identity and bank readiness.
   - Owner: KYC.
   - Why: CCCD/selfie evidence and approved bank data are the Level 2 work gate for paid bookings.
   - Booking impact: paid booking acceptance and backup participation stay blocked until the evidence is approved.
   - Payout impact: bank approval is required before payout; tax profile remains staged until first earning.

4. Refresh stale partner location.
   - Owner: Dispatch.
   - Why: 10km backup matching depends on a recent stored partner location.
   - Booking impact: stale location can exclude partners from backup matching or make distance ordering unreliable.
   - Payout impact: no direct payout impact, but location evidence may matter for disputes.

5. Confirm device and alert reachability.
   - Owner: Ops.
   - Why: partner response rate depends on recent app sessions and enabled devices while OS push is deferred.
   - Booking impact: weak device state does not always hard-block acceptance, but it reduces response reliability.
   - Payout impact: no direct payout impact.

6. Keep tax as a post-first-earning payout gate.
   - Owner: Finance.
   - Why: tax policy must exist from day one, but tax profile collection should not increase signup friction before the first earning.
   - Booking impact: missing tax profile should not block first booking acceptance.
   - Payout impact: after first earning, tax profile, tax address, and payout/tax agreements block payout or withdrawal until complete.

This order is mirrored in `/partner-controls` under `Acceptance unblock playbook`.

## No-Show Closeout

No-show is an operational closeout state, not an automatic penalty in the MVP. It should be used only when a live booking cannot proceed because the customer or partner did not continue the service path.

Current MVP behavior:

- Eligible statuses: open matching, matched, partner on the way, or arrived.
- Admin must enter a reason when possible.
- The booking is moved to `NO_SHOW`.
- A payment-review ops task is blocked until support decides release, refund, capture, fee, or manual adjustment.
- The customer receives a `booking.no_show` notification.
- The selected partner, preferred partner, and joined participants receive a `booking.no_show` notification.
- The booking detail page shows no-show notification count in the booking alert trace.
- `/notifications?review=no-show` shows all customer and partner no-show communication rows.

Keep penalties manual until arrival evidence, location proof, chat history, and dispute outcomes are reliable enough for automation. If the policy later changes to evidence-based automation, the no-show policy snapshot must still be saved on each alert and audit row.

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
- `apps/admin_web/app/partner-controls/page.tsx` and `apps/admin_web/app/partner-risk/page.tsx`

Legacy `/providers` and `/provider-risk` pages redirect to these canonical partner routes so older links keep working.

Partner mobile behavior:

- `apps/provider_app/lib/main.dart`
- `apps/provider_app/test/provider_wallet_gate_test.dart`

Smoke coverage:

- `infra/scripts/api-smoke.mjs`
- `infra/scripts/admin-web-smoke.mjs`

## Open Operator Decisions

These should stay configurable instead of being hardcoded:

- Preferred partner response window.
- Backup partner radius.
- Whether backup partners can appear immediately or only after a delay.
- Whether preferred partner acceptance requires customer final confirmation.
- Whether a negative-wallet partner can receive a controlled recovery booking.
- No-show thresholds and penalties.
- Cash settlement deadline.
- Notification retry and fallback contact rules.
- Tax policy version, service-specific tax rules, and amount-band rules.

## Verification Checklist

Before changing this flow, run:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
node .\infra\scripts\api-smoke.mjs
node .\infra\scripts\admin-web-smoke.mjs
```

For mobile guard changes:

```powershell
cd C:\dev\massage-vn-workspace\repo\apps\provider_app
flutter test

cd C:\dev\massage-vn-workspace\repo\apps\customer_app
flutter test
```
