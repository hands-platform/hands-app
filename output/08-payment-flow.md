# Payment and Wallet Flow

## Payment Methods

- MoMo
- VNPay
- Cash

MoMo and VNPay remain behind provider adapters until sandbox/production credentials are fully verified. Cash is active as an MVP method.

## Online Payment Flow

1. Customer confirms booking.
2. Payment is authorized or marked pending by adapter.
3. Booking opens matching.
4. If booking expires before match, authorization is released or refund is recorded.
5. If service completes, payment is captured/confirmed.
6. Admin can refund with an audited reason.

## Cash Flow

1. Customer pays partner directly in cash.
2. HANDS records platform fee, withholding, and fee policy snapshot.
3. Partner wallet ledger records the company receivable.
4. If the ledger becomes negative, partner marketplace participation and downstream booking gates are blocked until settlement or admin offset.
5. Customer wallet never becomes negative in the MVP.

## No Tip Policy

HANDS MVP does not collect, store, calculate, or expose customer tips or gratuity.
