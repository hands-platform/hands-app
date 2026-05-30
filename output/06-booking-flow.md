# Booking Flow and Status Mapping

## Requested Product Statuses
- CREATED
- PAYMENT_PENDING
- PAID
- OPEN_MATCHING
- partner_SELECTED
- ACCEPTED
- IN_PROGRESS
- COMPLETED
- CANCELLED
- REJECTED
- REFUNDED

## Current System Mapping
| Product status | Current backend model |
| --- | --- |
| CREATED | Booking.CREATED |
| PAYMENT_PENDING | Payment.PENDING with Booking.CREATED |
| PAID | Payment.AUTHORIZED or Payment.CAPTURED |
| OPEN_MATCHING | Booking.OPEN_MATCHING |
| partner_SELECTED | Booking.MATCHED |
| ACCEPTED | Booking.MATCHED or Booking.PROVIDER_ON_THE_WAY |
| IN_PROGRESS | Booking.IN_SERVICE |
| COMPLETED | Booking.COMPLETED |
| CANCELLED | Booking.CANCELLED |
| REJECTED | BookingParticipant.REJECTED |
| REFUNDED | Booking.REFUNDED and Payment.REFUNDED |

## Flow
1. CREATED: customer creates booking request.
2. PAYMENT_PENDING: online payment authorization is waiting.
3. PAID: payment authorization succeeds or cash method is accepted.
4. OPEN_MATCHING: matching window starts.
5. partner_SELECTED: customer selects preferred/final partner.
6. ACCEPTED: partner accepts/starts toward service.
7. IN_PROGRESS: partner starts service.
8. COMPLETED: service finished and earnings ledger created.
9. CANCELLED/REJECTED/REFUNDED: branch statuses by actor and payment state.

## Policy Values
- Preferred partner response window: admin configurable, default 10 minutes.
- Backup radius: admin configurable, default 10 km.
- Matching timeout: admin configurable.
- Final partner is always selected by customer, not automatically assigned.
