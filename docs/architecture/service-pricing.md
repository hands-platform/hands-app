# HANDS Service Pricing And Payout Matrix

## Purpose

HANDS services are managed as service-type and duration rows. A single service type can have many duration options:

- Foot Massage: 60 / 90 / 120 minutes
- Swedish Massage: 60 / 90 / 120 minutes
- Deep Tissue Massage: 60 / 90 / 120 minutes

The admin controls the minimum customer price for each service duration. Partners can set the same price or a higher price, but never below the admin minimum.

The customer-facing choice is therefore:

1. Choose the service type.
2. Choose one duration option.
3. Confirm the booking at the partner's active customer price for that option.

The admin-facing unit of control is the service duration option, not only the top-level service name.
For example, `Foot Massage / 60 min`, `Foot Massage / 90 min`, and `Foot Massage / 120 min`
can each have separate minimum prices and payout matrix rows.

## Price Rules

- Default customer price increment: `100000 VND`.
- `MassageService.basePrice` is the admin minimum customer price.
- `MassageService.priceStep` defines the allowed increment.
- `ProviderService.price` must be greater than or equal to `MassageService.basePrice`.
- `ProviderService.price` must be divisible by `MassageService.priceStep`.
- `ProviderService.price` can be activated only when an active
  `ServicePayoutRule` exists for the exact service and customer price.

The booking service row stores the actual customer price used at checkout, so later price changes do not rewrite booking history.

## Partner App Price Editor

The Partner app Profile tab includes a service pricing card. It loads
`GET /partner/services` and saves each row with
`PATCH /partner/services/:serviceId`.

The card shows:

- Admin minimum price.
- Current partner customer price.
- Active or paused booking state.
- Whether the admin payout rule is configured.
- Partner payout amount when the payout rule exists.

The Flutter UI validates minimum price and step size before saving. The API
revalidates the same rules and also checks payout-rule readiness, so old app
versions cannot activate unsupported prices.

## Payout Rules

`ServicePayoutRule` maps a customer price to the partner payout amount.

Example:

- Customer price: `500000 VND`
- Partner payout: `380000 VND`
- Total platform fee: `120000 VND`

The payout rule also stores:

- VAT basis points
- Other fixed cost amount
- Currency
- Active status
- Internal notes

Earnings prefer `ServicePayoutRule` when every booking service has a matching active rule. If a rule is missing, the system falls back to the generic versioned platform-fee policy.

## Finance Display

The admin earnings ledger shows:

- Gross booking amount
- Platform fee
- Partner payout rule snapshot
- VAT amount from the platform fee
- Vietnam freelance withholding amount
- Other cost amount
- Estimated actual company fee after VAT, withholding, and other costs

The admin booking monitor and booking detail page also show the selected service option,
customer price, admin minimum, partner payout amount, and platform fee so operations can
debug a booking without opening the full service matrix first.

Each completed earning stores the selected payout/tax rule snapshot for auditability.

## Cash Booking Wallet Logic

For cash bookings, the partner receives cash directly from the customer. HANDS records a negative wallet delta for the platform fee and withholding amount.

If the partner wallet is negative:

- The partner cannot accept new bookings.
- Admin finance can mark the cash fee as settled from Earnings, Payments, or Booking Detail after deposit or offset.
- The settlement action requires a deposit reference or offset reference on the earning row.
- The Partner app Earnings screen shows the debt amount and settlement instruction
  returned by `GET /partner/earnings/summary`.
- The Partner app warns before accepting cash requests that direct customer cash can create
  wallet debt after completion.

The partner-facing booking block copy currently follows the API message:

`수수료 정산이 완료되지 않아 예약을 받을 수 없습니다.`

Vietnamese localization should replace this fallback after the final UI language pass, but the API smoke test keeps the current message stable so the booking guard cannot silently drift.

## Future Work

- Bulk admin import/export for service matrix.
- Service-specific VAT and withholding policy mapping if Vietnam policy requires it.
