# Payment Flow

## Methods
- MoMo
- VNPay
- Cash
- Wallet/credit as Phase 2

## Online Payment
1. Customer confirms booking.
2. Payment is authorized or pending.
3. Booking opens matching after payment state is acceptable.
4. If booking expires, authorization is released or refunded.
5. If service completes, payment is captured/confirmed.
6. Admin can refund.

## Cash Payment
1. Customer selects cash.
2. Partner receives cash directly.
3. System calculates platform fee, VAT, withholding, and other policies.
4. Partner wallet can become negative for fees owed to HANDS.
5. Negative wallet blocks future booking acceptance.
6. Partner is guided to settle fee debt.

## Rules
- Pricing and payout rules are admin managed.
- Taxes and fee policies are not hardcoded.
- Default currency is VND.
- Service price increments are 100,000 VND.
