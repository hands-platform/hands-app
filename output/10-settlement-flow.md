# Settlement Flow

## Earnings
1. Booking completes.
2. Customer payment/cash record is finalized.
3. ProviderEarning is created.
4. Platform fee, tax, withholding, and other deductions are calculated from active policy versions.
5. Wallet ledger is updated.
6. Payout eligibility is recalculated.

## First Earning Tax Gate
- Tax information is not forced at initial signup.
- After the first earning, partner must complete tax profile before payout.
- The system policy exists from day one, even if partner tax profile is collected later.

## Cash Debt
- If partner receives cash directly, HANDS fee/tax owed can make wallet negative.
- Negative wallet blocks new booking acceptance.
- App message: unpaid service fee settlement prevents accepting new bookings.

## Payout
1. Partner requests withdrawal.
2. System checks KYC, bank, tax, agreement, wallet balance, account status.
3. Admin approves/rejects payout.
4. Ledger and payout batch update.

## Admin Controls
- Tax policy version
- Tax rules by service type, amount bracket, effective date
- Platform fee policy
- Payout batch status
- Wallet ledger correction with audit log
