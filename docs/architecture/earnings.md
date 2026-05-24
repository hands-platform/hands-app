# Provider Earnings

The MVP creates a provider earning record when the selected provider completes a booking.

## Flow

1. Provider calls `POST /provider/bookings/:id/complete`.
2. Booking status changes to `COMPLETED`.
3. Payment status changes to `CAPTURED`.
4. `ProviderEarning` is upserted by `bookingId`.
5. Provider can view earnings in the provider app.
6. Admin can monitor earnings and mark a record as paid.
7. Admin can create a provider payout batch from unpaid earnings.

## Calculation

- `grossAmount`: captured payment amount, falling back to booking service totals.
- `platformFee`: 20% of gross amount for the MVP.
- `withholdingAmount`: calculated from the active versioned tax policy.
- `tipAmount`: review tip amount, applied after the customer submits a review.
- `netAmount` for MoMo/VNPay: `grossAmount - platformFee - withholdingAmount + tipAmount`.
- `netAmount` for cash: `-(platformFee + withholdingAmount)` because the provider already received the customer cash directly.
- `availableAt`: 24 hours after completion for MVP payout review.

Cash bookings therefore create a company receivable instead of a provider payout. The provider wallet can go negative when cash-service platform fees or tax withholding have not been settled.

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

If the unsettled wallet balance is negative, the API blocks joining or accepting new bookings with:

`수수료에대한 정산이 되지 않아 예약을 받을수 없습니다`

This supports two later settlement paths without changing booking flow:

- Provider transfers the owed fee/tax amount directly to HANDS.
- HANDS offsets the negative balance against later positive online-payment payouts.

## Payout Batches

`ProviderPayoutBatch` groups one provider's unpaid positive earnings into a single payout record. The MVP marks the batch as `PAID` immediately and links included earnings through `payoutBatchId`.

This keeps the current product simple while preserving the later path for bank transfer references, processing states, failed payouts, and batch-level reconciliation.

## Next Production Work

- Move the fee rate into a versioned platform policy table.
- Add explicit wallet ledger entries for provider deposits and admin adjustments.
- Add provider-facing repayment instructions for negative cash fee balances.
- Add provider payout account verification.
- Add real bank transfer execution and failure retry.
- Add paid-earning reversal entries for post-payout refunds and disputes.
