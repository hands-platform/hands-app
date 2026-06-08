# Realtime Matching Implementation

## Redis Keys

- `providers:status` - provider id to status hash.
- `provider:{providerId}:location` - latest provider location, 10 minute TTL.
- `matching:active` - set of active matching booking ids.
- `matching:{bookingId}` - active matching payload, 10 minute TTL by default.
- `matching:{bookingId}:participants` - partners with actual marketplace participation records for a booking.

## Matching Policy

- First-pick partner response window: 10 minutes.
- Marketplace partner radius: 10km from the confirmed booking address.
- Marketplace eligibility uses the partner's last stored location; the MVP does not run route or live navigation APIs.
- Eligible marketplace partners receive a marketplace availability notification and can participate through `POST /partner/bookings/:id/join`.
- First-pick partner acceptance can match first when the API validates that it won the race.
- Customer final selection remains the source of truth when first-pick does not validly accept first.

## Admin-Operable Policy

Matching policy is backed by `OperationalPolicySetting` and exposed in Admin at `/operations-policy`.
Saved Admin values take priority over `.env` fallbacks for new booking creation, marketplace partner discovery,
and partner join eligibility.

Enforced settings:

- `matching.provider_response_window_minutes`
- `matching.backup_provider_radius_meters`
- `matching.backup_provider_location_max_age_minutes`
- `matching.backup_provider_invitation_limit`
- `matching.travel_buffer_minutes`
- `matching.preferred_accept_mode`
- `matching.backup_open_mode`

Compatibility note: the saved policy keys still contain `backup_provider` or `backup_open` for schema and migration stability. Admin and product-facing copy should describe these as marketplace partner participation.

Existing open bookings keep their stored `expiresAt` timestamp so operators do not accidentally change a
live customer countdown. `matching.preferred_accept_mode` is kept for snapshot compatibility, but the
MVP contract is fixed: first-pick partner acceptance can match first under API race rules; otherwise the
customer selects from participating partners.

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
