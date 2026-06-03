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

For cash bookings, the partner receives the customer payment directly. HANDS therefore
records platform fee and withholding as a partner wallet debt instead of treating the
full booking amount as money owed to the partner. A negative partner wallet can still
allow marketplace list visibility, but blocks marketplace join/participation, direct
acceptance, customer final partner selection, service start, and payout release until
the partner settles the fee with HANDS or the balance is offset against later
online-payment payouts. Customers do not carry a negative wallet in the MVP.

## Callback Routes

```http
POST /api/payments/MOMO/callback
POST /api/payments/VNPAY/callback
POST /api/payments/CASH/callback
```

The routes parse payment-provider payloads and update the payment by `providerRef`.

MoMo and VNPay callbacks are public provider-to-server routes, so the API verifies
provider signatures before trusting the payload when the relevant secret is configured:

- MoMo: HMAC-SHA256 over the IPN key/value payload with `MOMO_SECRET_KEY`.
- VNPay: HMAC-SHA512 over sorted `vnp_*` fields with `VNPAY_HASH_SECRET`.

In development, missing provider secrets keep the placeholder callback flow usable.
In production, missing MoMo/VNPay callback secrets reject callback processing.
Callback amount and merchant identity are also checked when those fields are present.
Repeated callbacks with the same terminal status are treated as idempotent replays;
conflicting terminal callback statuses are rejected.

## Refund Flow

Admin refunds update the payment to `REFUNDED`, move the booking to `REFUNDED`, create a `Refund` row, and cancel unpaid partner earnings. If the earning is already `PAID`, the MVP keeps it unchanged and writes the skip reason to `AdminAuditLog`.

## Production Hardening

- Store callback attempts for auditability.
- Replace placeholder status polling with provider API calls.
- Separate `AUTHORIZED`, `CAPTURED`, `RELEASED`, `REFUNDED` semantics by payment provider.
- Add payment provider replay nonce or provider transaction reference tracking once real sandbox credentials are connected.
