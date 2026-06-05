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
allow marketplace list visibility, but blocks marketplace participation and
payout release until the partner settles the fee with HANDS or the balance is offset
against later online-payment payouts. Customers do not carry a negative wallet in the MVP.

## Callback Routes

```http
POST /api/payments/MOMO/callback
POST /api/payments/VNPAY/callback
POST /api/payments/CASH/callback
```

The routes parse payment-gateway payloads and update the payment by the stored gateway reference field, currently named `providerRef` for schema compatibility.

MoMo and VNPay callbacks are public gateway-to-server routes, so the API verifies
gateway signatures before trusting the payload when the relevant secret is configured:

- MoMo: HMAC-SHA256 over the IPN key/value payload with `MOMO_SECRET_KEY`.
- VNPay: HMAC-SHA512 over sorted `vnp_*` fields with `VNPAY_HASH_SECRET`.

In development, missing gateway secrets keep the placeholder callback flow usable.
In production, missing MoMo/VNPay callback secrets reject callback processing.
Callback amount and merchant identity are also checked when those fields are present.
Repeated callbacks with the same terminal status are treated as idempotent replays;
conflicting terminal callback statuses are rejected.

## Admin Callback Audit

`/payments` in the admin dashboard exposes callback evidence for every payment row:

- gateway reference
- callback received time
- signature verification result
- verification mode
- gateway status or response code
- gateway transaction reference
- callback amount when the gateway sends it
- callback payload keys for quick operator inspection

The page includes two dedicated queues:

- `Callback review`: rejected, conflicting, or unsigned gateway callbacks that need operator review.
- `Callback verified`: accepted or replayed callbacks with verified signature evidence.

Operators should use this view before manual capture, release, refund, or settlement
actions. The backend remains the authority for accepting or rejecting callbacks; the
admin screen only exposes the saved evidence so finance can audit what happened.

Rejected and conflicting callbacks are stored in `PaymentCallbackAttempt` even when
the gateway reference cannot be matched to a saved payment. The admin payment page
shows the recent attempt ledger so operators can inspect unknown references, missing
signatures, amount mismatches, merchant mismatches, terminal replays, and terminal
conflicts without trusting the callback payload as business truth.

`GET /admin/payments/:id` powers a dedicated payment operation detail page. It groups
the payment, linked booking, customer, partner, chat evidence, refunds, earning,
wallet ledger, tax/fee logs, callback attempts, and admin audit trail into a single
inspection screen. This page is the finance operator's first stop before manual
sync, capture, release, refund, or cash fee settlement actions.

## Refund Flow

Admin refunds update the payment to `REFUNDED`, move the booking to `REFUNDED`, create a `Refund` row, and cancel unpaid partner earnings. If the earning is already `PAID`, the MVP keeps it unchanged and writes the skip reason to `AdminAuditLog`.

## Production Hardening

- Add gateway-specific field mapping once real MoMo/VNPay sandbox data is connected.
- Replace placeholder status polling with gateway API calls.
- Separate `AUTHORIZED`, `CAPTURED`, `RELEASED`, `REFUNDED` semantics by gateway.
- Add gateway replay nonce or transaction reference tracking once real sandbox credentials are connected.
