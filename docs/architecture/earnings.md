# Provider Earnings

The MVP creates a provider earning record when the selected provider completes a booking.

## Flow

1. Provider calls `POST /provider/bookings/:id/complete`.
2. Booking status changes to `COMPLETED`.
3. Payment status changes to `CAPTURED`.
4. `ProviderEarning` is upserted by `bookingId`.
5. Provider can view earnings in the provider app.
6. Admin can monitor earnings, settle cash fee debt, and create payout batches.

## Calculation

- `grossAmount`: captured payment amount, falling back to booking service totals.
- `platformFee`: calculated from a service payout rule first, then from the active platform fee policy if no matching rule exists.
- `withholdingAmount`: calculated from the active versioned tax policy.
- `tipAmount`: review tip amount, applied after the customer submits a review.
- `netAmount` for MoMo/VNPay: `grossAmount - platformFee - withholdingAmount + tipAmount`.
- `netAmount` for cash: `-(platformFee + withholdingAmount)` because the provider already received the customer cash directly.
- `availableAt`: 24 hours after completion for MVP payout review.

Cash bookings therefore create a company receivable instead of a provider payout. The provider wallet can go negative when cash-service platform fees or tax withholding have not been settled.

## Service Payout Matrix

Completed earnings prefer the `ServicePayoutRule` matrix before falling back to the generic platform-fee policy.

The matrix is configured per service duration and customer price:

- Admin sets the minimum customer price on `MassageService.basePrice`.
- Provider prices must stay at or above that minimum and follow the service `priceStep`, currently `100000 VND`.
- Admin maps each configured customer price to a provider payout amount.
- The platform fee is calculated as customer price minus provider payout.
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

## Provider Wallet Guard

For the MVP, `ProviderEarning.netAmount` is also the provider wallet delta:

- Positive delta: HANDS owes money to the provider.
- Negative delta: the provider owes HANDS fees/tax from cash bookings.

If the unsettled wallet balance is negative, the API blocks joining or accepting new bookings and should show the provider a localized message equivalent to:

`Unsettled HANDS service fee blocks new bookings. Please settle your fee balance before accepting a request.`

This supports two later settlement paths without changing booking flow:

- Provider transfers the owed fee/tax amount directly to HANDS.
- HANDS offsets the negative balance against later positive online-payment payouts.

The admin earnings screen separates negative cash wallet rows into a cash fee debt queue. After finance confirms the provider deposit or an approved offset, the operator marks the negative earning as settled. This moves the row to `PAID`, removes it from the unsettled wallet balance, and unblocks the provider from accepting new requests.

## Payout Batches

`ProviderPayoutBatch` groups one provider's unpaid positive earnings into a single payout record. The MVP marks the batch as `PAID` immediately and links included earnings through `payoutBatchId`.

This keeps the current product simple while preserving the later path for bank transfer references, processing states, failed payouts, and batch-level reconciliation.

## Next Production Work

- Add explicit wallet ledger entries for provider deposits and admin adjustments.
- Add provider-facing repayment instructions for negative cash fee balances.
- Add provider payout account verification.
- Add real bank transfer execution and failure retry.
- Add paid-earning reversal entries for post-payout refunds and disputes.
