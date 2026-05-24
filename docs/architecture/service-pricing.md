# HANDS Service Pricing And Payout Matrix

## Purpose

HANDS services are managed as service-type and duration rows. A single service type can have many duration options:

- Foot Massage: 60 / 90 / 120 minutes
- Swedish Massage: 60 / 90 / 120 minutes
- Deep Tissue Massage: 60 / 90 / 120 minutes

The admin controls the minimum customer price for each service duration. Providers can set the same price or a higher price, but never below the admin minimum.

## Price Rules

- Default customer price increment: `100000 VND`.
- `MassageService.basePrice` is the admin minimum customer price.
- `MassageService.priceStep` defines the allowed increment.
- `ProviderService.price` must be greater than or equal to `MassageService.basePrice`.
- `ProviderService.price` must be divisible by `MassageService.priceStep`.

The booking service row stores the actual customer price used at checkout, so later price changes do not rewrite booking history.

## Payout Rules

`ServicePayoutRule` maps a customer price to the provider payout amount.

Example:

- Customer price: `500000 VND`
- Provider payout: `380000 VND`
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
- Provider payout rule snapshot
- VAT amount from the platform fee
- Vietnam freelance withholding amount
- Other cost amount
- Estimated actual company fee after VAT, withholding, and other costs

Each completed earning stores the selected payout/tax rule snapshot for auditability.

## Cash Booking Wallet Logic

For cash bookings, the provider receives cash directly from the customer. HANDS records a negative wallet delta for the platform fee and withholding amount.

If the provider wallet is negative:

- The provider cannot accept new bookings.
- Admin finance can mark the cash fee as settled after deposit or offset.
- Future work should add a provider-facing deposit instruction flow.

## Future Work

- Provider-facing service price editor.
- Bulk admin import/export for service matrix.
- Service-specific VAT and withholding policy mapping if Vietnam policy requires it.
- Provider app warning before accepting cash bookings when wallet risk is high.
