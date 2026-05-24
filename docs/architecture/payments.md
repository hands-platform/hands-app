# Payments

## Current MVP

Payments are behind a small adapter interface:

- `MomoPaymentAdapter`
- `VnpayPaymentAdapter`
- `CashPaymentAdapter`

Each adapter supports:

- `authorize`
- `parseCallback`
- `checkStatus`
- `release`

## Booking Flow

1. Customer creates booking.
2. API creates a `Payment`.
3. Adapter returns authorization status and placeholder checkout metadata.
4. API schedules a `payment-status-check` BullMQ job.
5. Booking opens for matching.
6. If booking expires before match, the timeout processor calls `PaymentsService.release`.
7. If service completes, booking completion captures the payment in the current skeleton.

For cash bookings, the provider receives the customer payment directly. HANDS therefore
records platform fee and withholding as a provider wallet debt instead of treating the
full booking amount as money owed to the provider. A negative provider wallet blocks new
booking acceptance until the provider settles the fee with HANDS or the balance is offset
against later online-payment payouts.

## Callback Routes

```http
POST /api/payments/MOMO/callback
POST /api/payments/VNPAY/callback
POST /api/payments/CASH/callback
```

The routes parse provider payloads and update the payment by `providerRef`.

## Refund Flow

Admin refunds update the payment to `REFUNDED`, move the booking to `REFUNDED`, create a `Refund` row, and cancel unpaid provider earnings. If the earning is already `PAID`, the MVP keeps it unchanged and writes the skip reason to `AdminAuditLog`.

## Production Hardening

- Verify MoMo signatures.
- Verify VNPay secure hash.
- Store callback attempts for auditability.
- Replace placeholder status polling with provider API calls.
- Separate `AUTHORIZED`, `CAPTURED`, `RELEASED`, `REFUNDED` semantics by provider.
- Do not trust client-provided callback status.
