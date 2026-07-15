# Payments

## Current MVP

Payments are behind a small adapter interface:

- `MomoPaymentAdapter`
- `VnpayPaymentAdapter`
- `CardPaymentAdapter`
- `CashPaymentAdapter`

Each adapter supports:

- `initialAuthorization` for synchronous payment data written with the booking
- `authorize`
- `parseCallback`
- `checkStatus`
- `capture`
- `release`
- `refund`
- `checkRefund`

`authorize`, `checkStatus`, and `release` are asynchronous contracts. Booking and
payment rows are created before the post-booking authorization call, so a future
gateway HTTP request is never hidden inside the Prisma create operation.

Before either online adapter can move from `PLACEHOLDER` to `GATEWAY`, the booking
initialization flow must preserve this recovery order:

1. Create the booking in `CREATED`, not `OPEN_MATCHING`.
2. Persist the deterministic gateway order reference and an `INITIALIZING` marker.
3. Send the idempotent gateway request after the database write commits.
4. Apply the adapter-specific matching gate. MoMo may open after checkout initialization;
   VNPay stays `CREATED` until a signed callback or query confirms provider capture.
5. On timeout, keep the booking out of matching and schedule a gateway status query.
6. Allow a verified callback or status query to recover the same booking without
   creating a second charge or a second booking.

The database and queue recovery state machine is now present but dormant: an adapter
must explicitly report `mode = GATEWAY` before it can use it. A timed-out gateway
authorization remains in `CREATED`, stores `RETRY_PENDING`, and schedules one
idempotent status-check job per payment. A verified callback or status query marks
the existing payment `READY`; a separate booking recovery worker then revalidates
the booking/payment pair, payment state, gateway mode, and matching expiry before a
CAS transition opens matching. The customer app reads its checkout catalog from
`GET /api/customer/payment-methods`; the default catalog contains only cash. MoMo and VNPay
select their real clients only when `MOMO_GATEWAY_ENABLED=true` or
`VNPAY_GATEWAY_ENABLED=true`; both defaults are false, so credentials alone cannot enable
external money movement.

Redirect payment methods also require
`CUSTOMER_APP_PAYMENT_REDIRECT_FLOW_ENABLED=true`. Keep this false until the mobile app can
open the returned gateway checkout URL and safely resume the owning booking. This extra gate
prevents a backend-only gateway configuration from exposing an incomplete customer journey.

`CardPaymentAdapter` currently exists only as a fail-closed local placeholder boundary.
It allows the existing `CARD` booking contract to be exercised with
`ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS=true` in non-production environments. It has
no production gateway client, and production rejects CARD checkout until one is
explicitly implemented and enabled.

## Booking Flow

1. Customer creates booking.
2. API creates a `Payment`.
3. Cash uses the internal adapter. MoMo/VNPay use disabled-by-default real gateway adapters.
4. API schedules a `payment-status-check` BullMQ job.
5. Booking opens for matching.
6. If booking expires before match, the timeout processor calls `PaymentsService.release`.
7. If service completes, booking completion captures the payment in the current skeleton.

For cash bookings, the partner receives the customer payment directly. HANDS therefore
records platform fee and withholding as a partner wallet debt instead of treating the
full booking amount as money owed to the partner. A negative partner wallet can still
allow marketplace list visibility and join records, but blocks final acceptance,
service start, and payout release until the partner settles the fee with HANDS or the balance is offset
against later online-payment payouts. Customers do not carry a negative wallet in the MVP.

## Callback Routes

```http
POST /api/payments/MOMO/callback
POST /api/payments/VNPAY/callback
POST /api/payments/CASH/callback
GET  /api/payments/VNPAY/callback
```

The generic POST routes preserve the current provider callback contract. VNPay additionally uses
the official GET IPN route, reads signed `vnp_*` query fields, and returns the provider acknowledgement
codes `00`, `01`, `02`, `04`, `97`, or `99`. The routes update payment by the stored gateway reference
field, currently named `providerRef` for schema compatibility.

MoMo and VNPay callbacks are public gateway-to-server routes, so the API verifies
gateway signatures before trusting the payload when the relevant secret is configured:

- MoMo: HMAC-SHA256 over the IPN key/value payload with `MOMO_SECRET_KEY`.
- VNPay: HMAC-SHA512 over sorted `vnp_*` fields with `VNPAY_HASH_SECRET`.
- Gateway callbacks fail closed when their signing secret is absent. Only intentional local fixtures may set `ALLOW_UNVERIFIED_PAYMENT_CALLBACKS=true`; production ignores that override and still rejects unsigned callbacks.

Only an intentional non-production UI fixture may set
`ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS=true` to receive placeholder checkout
metadata. Production ignores this override and rejects placeholder authorization.
Missing MoMo/VNPay callback secrets reject callback processing unless an intentional
non-production fixture separately enables `ALLOW_UNVERIFIED_PAYMENT_CALLBACKS=true`.
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

Admin refunds first create a durable `REQUESTED` refund. A successful provider refund
moves it to `GATEWAY_CONFIRMED`; only then does one database transaction move the
payment and booking to `REFUNDED`, reverse settlement/accounting, cancel or recover
partner earnings, and mark the refund `COMPLETED`. A retry resumes a
`GATEWAY_CONFIRMED` refund without submitting the provider refund again.

## Production Hardening

- MoMo and VNPay are feature-gated. External readiness remains failed until the
  corresponding gateway flag is true, credentials and HTTPS endpoints are present,
  and the remaining sandbox E2E succeeds.
- `payment-gateway-requests.ts` contains pure, fixture-tested MoMo `captureWallet`,
  transaction-query, refund, and refund-query signatures plus VNPay v2.1.0 checkout,
  `querydr`, and full-refund request builders.
- `MomoGatewayClient` implements the real server-to-server create/query/capture/cancel/refund/refund-query HTTP boundary,
  including the documented 30-second minimum timeout, response identity/amount/signature
  checks, idempotent operation references, fail-closed configuration, credential-free HTTPS URL enforcement,
  and result-code mapping.
  `MomoPaymentAdapter` selects it only through the explicit disabled-by-default feature flag.
- `VnpayGatewayClient` builds the signed checkout URL and verifies signed `querydr`
  and refund responses using Vietnam time, while rejecting non-HTTPS or credential-bearing
  gateway and return URLs before network access. `VnpayPaymentAdapter` selects it only through
  `VNPAY_GATEWAY_ENABLED=true`. A pending VNPay payment cannot open matching, capture is
  confirmed through `querydr`, and accepted refunds remain provider-processing until a
  signed query reports refund transaction type `02` or `03` with status `00`.
- Captured VNPay payments never pass through release. They require the audited refund
  workflow. Unpaid checkout release is allowed only after the retained provider expiry
  and a signed query that does not report capture.
- When a captured gateway booking is cancelled or its matching window expires, HANDS closes
  the booking and creates one idempotent `REQUESTED` refund instead of claiming that the
  provider payment was released. Finance supplies the maker/approver context before gateway
  submission. A delayed VNPay capture receives a fresh provider-response window when matching
  is opened, so checkout time does not consume partner response time.
- `MOMO_REDIRECT_URL` must point to a real customer-facing return/deep-link bridge.
  It must not point at an Admin Web page, and the example remains blank until that
  customer return route exists.
- Add gateway-specific field mapping once real MoMo/VNPay sandbox data is connected.
- Replace placeholder status polling with gateway API calls.
- Run timeout, delayed callback, duplicate callback, and status-query recovery against
  both gateway sandboxes before switching either adapter to `GATEWAY`.
- Separate `AUTHORIZED`, `CAPTURED`, `RELEASED`, `REFUNDED` semantics by gateway.
- Add gateway replay nonce or transaction reference tracking once real sandbox credentials are connected.
### Asynchronous provider refund completion

Payment providers may acknowledge a refund request before the refund is final. HANDS keeps these
refunds in `PROVIDER_PROCESSING`, leaves the payment and booking captured, and schedules a retained
`payment-refund-status` BullMQ job. Settlement reversal, earning cancellation, booking refund, and
payment refund are committed only after the adapter reports `providerFinalized: true`. The immutable
request actor, separate finance approver, and original occurrence time are recovered from refund
metadata; missing audit context fails closed.

Cash and MoMo refund submission remain synchronous, while the official MoMo refund-query
boundary can safely recover a provider-processing refund when needed. Keep VNPay disabled until checkout,
IPN replay, missing-IPN status recovery, matching recovery, rejected refund, asynchronous refund
completion, and paid-unmatched booking handling pass against sandbox responses.
