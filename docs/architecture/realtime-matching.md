# Realtime Matching Implementation

## Redis Keys

- `providers:status` - provider id to status hash.
- `provider:{providerId}:location` - latest provider location, 10 minute TTL.
- `matching:active` - set of active matching booking ids.
- `matching:{bookingId}` - active matching payload, 10 minute TTL by default.
- `matching:{bookingId}:participants` - providers who joined a booking.

## Matching Policy

- Preferred partner response window: 10 minutes.
- Backup partner radius: 10km from the booking location.
- Backup eligibility uses the partner's last stored location; the MVP does not run route or live navigation APIs.
- Eligible backup partners receive `booking.backup_available` and can join through `POST /provider/bookings/:id/join`.
- Customer final selection remains the source of truth. The first-picked partner can accept first, but
  the customer still confirms the final partner before the booking is matched.

## Admin-Operable Policy

Matching policy is backed by `OperationalPolicySetting` and exposed in Admin at `/operations-policy`.
Saved Admin values take priority over `.env` fallbacks for new booking creation, backup partner discovery,
and partner join eligibility.

Enforced settings:

- `matching.provider_response_window_minutes`
- `matching.backup_provider_radius_meters`
- `matching.travel_buffer_minutes`
- `matching.preferred_accept_mode`
- `matching.backup_open_mode`

Existing open bookings keep their stored `expiresAt` timestamp so operators do not accidentally change a
live customer countdown. `matching.preferred_accept_mode` controls whether the first-picked partner
acceptance immediately matches the booking or keeps the booking open until the customer confirms that
partner as the final selection.

## BullMQ Queues

- `booking-timeouts`
  - Job name: `booking-timeout`
  - Job id: `booking-timeout:{bookingId}`
  - Behavior: if the booking is still `OPEN_MATCHING`, mark it `EXPIRED`, release payment, close Redis matching state, emit `booking.expired`.

## Socket.IO Events

Emitted by REST-backed services:

- `booking.opened`
- `provider.joined`
- `booking.matched`
- `booking.expired`
- `service.completed`

Location gateway emits:

- `provider.location.updated`

## Socket Auth

Socket.IO clients must send the access token in either:

```ts
io(API_URL, { auth: { token: accessToken } });
```

or as an `Authorization: Bearer <accessToken>` handshake header. Booking and chat room joins are checked against customer ownership, provider participation/selection, or admin role.

## Auth Note

REST routes use `Authorization: Bearer <accessToken>`. The OTP endpoint returns signed dev tokens and route handlers enforce customer, provider, and admin role boundaries through guards.
