# Reviews And Ratings

## Customer Review Rules

- A customer can review only their own booking.
- Booking must be `COMPLETED`.
- Booking must have a selected partner.
- Rating must be between 1 and 5.
- One review per booking is enforced by the unique `bookingId` relation.

## Provider Rating

After review creation or moderation, the API recalculates:

- `ProviderProfile.ratingAvg`
- `ProviderProfile.reviewCount`

Only `PUBLISHED` reviews count toward provider rating.

## Moderation

Admin can update review status:

- `PUBLISHED`
- `HIDDEN`
- `REPORTED`

Moderation writes an `AdminAuditLog` entry and recalculates provider rating.
