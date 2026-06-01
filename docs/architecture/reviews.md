# Reviews And Feedback Records

## Customer Feedback Rules

- A customer can leave feedback only for their own booking.
- Booking must be `COMPLETED`.
- Booking must have a selected partner.
- One feedback record per booking is enforced by the unique `bookingId` relation.

## Partner Feedback Policy

HANDS MVP should not use customer or partner feedback as a people-ranking, risk-scoring, or automatic dispatch system.

- Existing legacy fields such as `ProviderProfile.ratingAvg` and `ProviderProfile.reviewCount` may remain for compatibility until a planned schema migration.
- Admin should treat feedback as factual service evidence: what was written, when it was written, which booking it belongs to, and whether it needs moderation.
- Dispatch, matching, account status, and partner visibility should not be automatically decided by average score.
- Customer records should show booking behavior, chat evidence, payment/refund history, saved addresses, and operator notes, not a customer score.

## Moderation States

Admin can update feedback status:

- `PUBLISHED`
- `HIDDEN`
- `REPORTED`

Moderation writes an `AdminAuditLog` entry. If legacy aggregate review fields are recalculated for compatibility, they must remain informational and must not drive automatic closeout decisions, badges, rankings, or dispatch priority.
