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
| Total reservation volume | `Total bookings` | Confirm the loaded admin snapshot size before making shift decisions. |
| Current matching pressure | `Open matching`, `Matching control room` | Open Booking Monitor and protect waiting customers before the response window expires. |
| Completed services | `Completed bookings`, `Closeout follow-up` | Confirm capture, earning, tax, fee, wallet, review, and notification closeout. |
| Cancelled reservations | `Cancelled bookings` | Check refund or payment release outcome. |
| No-show follow-up | `No-show signal` | Review payment, customer communication, and partner settlement impact. |
| Hourly demand | `Hourly booking demand` | Plan partner supply by time slot and identify peak-hour gaps. |
| Regional demand | `Regional booking demand` | Compare demand by city/district and partner location freshness. |
| Active app presence | `Customers in app`, `Partners in app`, `Active customers` | Distinguish live app demand/supply from stale users. |
| Partner supply | `Online partners`, `Partner dispatch control` | Review direct-ready, marketplace-ready, blocked, or stale partners. |
| Cash settlement pressure | `Cash debt` | Open Cash Settlements before negative-wallet partners accept more bookings. |
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
- Marketplace partner location freshness: 30 minutes.
- Marketplace partners can appear while the preferred partner is still deciding.
- Customer always selects the final partner.
- A negative partner wallet blocks booking acceptance or marketplace joining when the configured gate requires it.

These values should be changed through Admin `/operations-policy` or environment defaults, not hardcoded in mobile UI.

## Verification

Run these checks after dashboard or policy changes:

```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run admin:web-smoke
node .\infra\scripts\check-secret-leaks.mjs
git diff --check
```

The admin smoke test includes markers for the required dashboard KPIs so accidental removal of key operating signals is caught early.
