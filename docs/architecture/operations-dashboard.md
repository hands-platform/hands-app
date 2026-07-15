# HANDS Operations Dashboard

The Admin home page is the first shift screen for HANDS operations. It is designed for dispatch, customer support, finance, and partner review to see the same operating picture before opening detail pages.

Admin URL:

```text
http://localhost:3101/
```

## Purpose

The dashboard answers these shift questions:

- Is customer demand waiting for partner action?
- Are enough partners online, fresh, and eligible within the configured radius?
- Are payment holds, cash debts, payouts, failed notifications, or refunds blocking service?
- Are completed, cancelled, expired, or no-show bookings still missing finance closeout?
- Which admin page should the operator open next?

## Required KPI Coverage

| Operating need | Dashboard KPI or section | Operator action |
| --- | --- | --- |
| Total booking volume | `Total bookings` | Confirm the loaded admin snapshot size before making shift decisions. |
| Current matching pressure | `Waiting for Partner`, `Matching exceptions` | Open Booking Monitor and protect waiting customers before the response window expires. |
| Completed services | `Completed bookings`, `Closeout follow-up` | Confirm capture, earning, tax, fee, wallet, review, and notification closeout. |
| Cancelled bookings | `Cancelled bookings` | Check refund or payment release outcome. |
| No-show follow-up | `No-show evidence` | Review payment, customer communication, and partner settlement impact. |
| Hourly demand | `Hourly booking demand` | Plan partner supply by hour window and identify peak-hour gaps. |
| Regional demand | `Regional booking demand` | Compare demand by city/district and partner location freshness. |
| Active app presence | `Customers in app`, `Partners in app`, `Active customers` | Distinguish live app demand/supply from stale users. |
| Partner supply | `Ready Partners`, `Partner dispatch control` | Review direct-ready, marketplace-ready, blocked, or stale partners. |
| Cash settlement pressure | `Cash debt` | Open Cash Settlements before negative-wallet partners try to join marketplace bookings or receive payout release. |
| Finance pressure | `Payment holds`, `Available payout`, `Open payout batches` | Open Payments, Earnings, or Payouts to close money tasks. |
| Notification follow-up | `Failed notifications` | Retry or inspect disabled devices before customers or partners miss critical state changes. |
| Checklist next work | `Action queue`, `Shift command briefing`, `Opening shift checklist` | Follow the first recommended action instead of scanning pages manually. |

## Shift Flow

1. Start with `Shift command briefing`.
2. Open the primary recommended action.
3. Use `Opening shift checklist` to clear waiting customers, partner supply, cash debt, payouts, notifications, and setup blockers.
4. Review `Policy outcome pulse` when matching outcomes look slow or unstable.
5. Use `Matching control room` for open matching rows, timer state, marketplace supply, saved policy snapshots, and partner location freshness.
6. Use hourly and regional demand panels to decide whether to widen partner outreach, run incentives, or adjust staffing.
7. Finish with `Action queue` and `Audit Log` so manual decisions remain traceable.

## Admin Information Architecture

The Admin sidebar keeps existing working routes stable and groups them into operating lanes instead of renaming or deleting pages during MVP development.

| Lane | Purpose |
| --- | --- |
| `Command` | Start-of-shift dashboard, handoff, app presence, and failed critical alerts. |
| `Bookings` | Booking list, attention queue, first-pick, marketplace, customer choice, chat repair, and no-show evidence. |
| `Partners` | Partner list/detail, KYC, wallet gates, marketplace readiness, and manual partner controls. |
| `Customers` | Customer list/detail, live customers, booking history, wallet/address facts, and retained chat evidence. |
| `Finance` | Payments, earnings, cash settlements, payout batches, refunds, and closeout. |
| `Policy` | Operations policy, service catalog, payout/price rules, tax policy, and coupons. |
| `Evidence and System` | Chat archive, notifications, feedback, audit log, and setup readiness. |

The top sidebar `Shift Flow` is intentionally short:

1. Start Shift
2. Urgent Bookings
3. Marketplace
4. Cash Debt
5. Handoff

This gives operators a predictable first route without hiding the deeper pages needed for detailed checks.

## Source Pages

The dashboard links to these deeper operating pages:

- `/bookings` for live booking, matching, no-show, closeout, and customer final selection.
- `/operations-policy` for response windows, marketplace radius, wallet gates, cancellation/no-show policy, and owner decision backlog.
- `/partners` for KYC, acceptance blockers, partner readiness, location freshness, device/push health, and payout/tax readiness.
- `/partner-controls` for factual partner controls, account blocks, wallet debt, location freshness, device state, and unblock actions.
- `/cash-settlements` for negative wallet debt created by cash bookings.
- `/payments`, `/refunds`, `/earnings`, and `/payouts` for finance operations.
- `/notifications` for failed delivery and disabled device review.
- `/app-sessions` for live app presence.
- `/audit-log` for state-change traceability.

## Policy Alignment

The dashboard intentionally mirrors the current MVP operations policy:

- Preferred partner response window: 10 minutes.
- Marketplace partner radius: 10km.
- Marketplace partner stale threshold: 90 minutes. Active bookings refresh at most every 30 minutes.
- Marketplace partners can appear while the preferred partner is still deciding.
- First-pick valid acceptance can match first; otherwise the customer selects from participating partners.
- A negative partner wallet can still allow marketplace list visibility and join records, but blocks final acceptance, service start, and payout release until settlement or admin offset clears the debt.
- Wallet-blocked view attempts are not participant records. Admin tracks why the wallet is negative and whether the cash fee settlement has been paid or offset.

These values should be changed through Admin `/operations-policy` or environment defaults, not hardcoded in mobile UI.

## Verification

Run these checks after dashboard or policy changes:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run admin:web-smoke
node .\infra\scripts\check-secret-leaks.mjs
git diff --check
```

The admin smoke test includes markers for the required dashboard KPIs so accidental removal of key operating records is caught early.
