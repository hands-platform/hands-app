# Partner Earnings

The MVP creates a partner earning record when the selected partner completes a booking.

## Flow

1. Partner calls `POST /partner/bookings/:id/complete`.
2. Booking status changes to `COMPLETED`.
3. Payment status changes to `CAPTURED`.
4. `ProviderEarning` is upserted by `bookingId`.
5. Partner can view earnings in the partner app.
6. Admin can monitor earnings, settle cash fee debt, and create payout batches.

## Calculation

- `grossAmount`: captured payment amount, falling back to booking service totals.
- `platformFee`: calculated from a service payout rule first, then from the active platform fee policy if no matching rule exists.
- `withholdingAmount`: calculated from the active versioned tax policy.
- `tipAmount`: legacy database field retained for compatibility, but HANDS MVP does not collect or apply tips.
- `netAmount` for MoMo/VNPay: `grossAmount - platformFee - withholdingAmount`.
- `netAmount` for cash: `-(platformFee + withholdingAmount)` because the partner already received the customer cash directly.
- `availableAt`: 24 hours after completion for MVP payout review.

Cash bookings therefore create a company receivable instead of a partner payout. The partner wallet can go negative when cash-service platform fees or tax withholding have not been settled.

## Service Payout Matrix

Completed earnings prefer the `ServicePayoutRule` matrix before falling back to the generic platform-fee policy.

The matrix is configured per service duration and customer price:

- Admin sets the minimum customer price on `MassageService.basePrice`.
- Partner prices must stay at or above that minimum and follow the service `priceStep`, currently `100000 VND`.
- Admin maps each configured customer price to a partner payout amount.
- The platform fee is calculated as customer price minus partner payout.
- VAT, withholding, other costs, and estimated net company commission are shown in the admin earnings ledger.

Every earning stores a platform fee rule snapshot, so future policy edits do not rewrite historical finance records.

## Platform Fee Policy

Platform fees are versioned like tax policies. The MVP seeds an active default policy (`platform-fee-vn-mvp-2026`) with a 20% default rule, but the calculation reads from database policy rows rather than a code constant. Each completed booking writes a `ProviderPlatformFeeLog` with the applied policy version, rule snapshot, gross amount, and fee amount so finance can audit historical fee calculations after policy changes.

## Statuses

- `PENDING`: completed service has been recorded.
- `AVAILABLE`: future payout automation can move reviewed earnings here.
- `PAID`: admin has marked the earning as paid.
- `CANCELLED`: reserved for refunds, disputes, or chargeback handling.

Admin refunds cancel unpaid earnings and set their net amount to zero. If an earning is already paid, the MVP preserves it and records the skip reason in the audit log.

## Partner Wallet Guard

For the MVP, the partner wallet guard still reads unsettled `ProviderEarning.netAmount` totals because that keeps final-gate checks fast and simple:

- Positive delta: HANDS owes money to the partner.
- Negative delta: the partner owes HANDS fees/tax from cash bookings.

If the unsettled wallet balance is negative, the API still allows marketplace visibility and join intent, but blocks final acceptance or customer final selection when the configured gate requires settlement. It returns the partner-facing message:

`Outstanding HANDS fee settlement must be completed before final acceptance, customer selection, service start, or payout release.`

This supports two settlement paths without hiding partners from the marketplace:

- Partner transfers the owed fee/tax amount directly to HANDS.
- HANDS offsets the negative balance against later positive online-payment payouts.

The admin earnings screen separates negative cash wallet rows into a cash fee debt queue. The admin payments list and booking detail page also expose direct settlement forms for the same debt when finance is reviewing a cash booking from operational context.

After finance confirms the partner deposit or an approved offset, the operator must enter a deposit reference or offset reference and marks the negative earning as settled. This stores `settlementRef`/`settlementNotes`, moves the row to `PAID`, removes it from the unsettled wallet balance, and unblocks the partner from final acceptance. The API rejects cash-fee debt settlement without a reference because finance needs an auditable payment or offset trail.

`ProviderWalletLedgerEntry` records the finance audit trail around those earning rows:

- `BOOKING_EARNING`: created when a booking completion creates or updates the earning.
- `CASH_FEE_DEBT_SETTLED`: created when finance confirms a partner repayment or offset for a negative cash earning.
- `PAYOUT_PAID`: created when admin payout processing moves partner money out of the wallet.
- `REFUND_REVERSAL`: created when an unpaid earning is cancelled after a refund.

These ledger entries are append-friendly audit mirrors for finance and admin review. The direct guard can later move from earning totals to ledger totals once deposits, admin adjustments, and bank payout retries become richer.

## Payout Batches

`ProviderPayoutBatch` groups one partner's unpaid positive earnings into a single payout record. The admin can move a batch through `DRAFT`, `PROCESSING`, `PAID`, `FAILED`, and `CANCELLED`. A bank transfer reference is required before a batch can be marked `PAID`, and included earnings are linked through `payoutBatchId`.

This keeps the current product simple while preserving the later path for real bank transfer execution, failed payout recovery, and batch-level reconciliation.

## Next Production Work

- Add admin adjustment entries for manual wallet corrections.
- Add partner payout account verification.
- Add real bank transfer execution and failure retry.
- Add paid-earning reversal entries for post-payout refunds and disputes.
