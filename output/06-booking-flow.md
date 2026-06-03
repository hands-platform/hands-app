# Booking Flow

## States

| State | Meaning |
| --- | --- |
| `CREATED` | Booking request created with address snapshot and service option. |
| `OPEN_MATCHING` | First-pick and marketplace participation window is active. |
| `MATCHED` | Customer selected the final partner. |
| `PROVIDER_ON_THE_WAY` | Internal compatibility state for partner travel/work preparation. |
| `ARRIVED` | Partner arrived or is ready to begin. |
| `IN_SERVICE` | Service is active and chat/work evidence continues. |
| `COMPLETED` | Service completed. |
| `CANCELLED` | Admin-closed cancellation. |
| `EXPIRED` | Matching window expired without final selection. |
| `REFUNDED` | Payment/refund closure recorded. |

## Creation Requirements

- Customer can browse from any country.
- Booking creation requires confirmed service address inside the active service area.
- API stores `BookingAddressSnapshot`.
- API snapshots selected service, duration, price, payout, tax/fee policy, and payment method.

## Matching Rules

- Preferred partner gets a 10-minute first-pick response window by default.
- Marketplace partners can join within the configured booking-address radius, 10km by default.
- Partner distance is calculated server-side from the booking address.
- Customer always chooses the final partner.
- No automatic assignment.

## Closure Rules

- No normal customer cancellation button after direct matching in MVP.
- Cancellation and no-show decisions are admin actions based on chat/evidence.
- Completed bookings can produce factual feedback records, not scores or rankings.
