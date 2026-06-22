# Low-Cost Location System

HANDS is not a realtime GPS tracking product. The MVP uses confirmed service addresses, short-lived partner availability signals, and aggregate admin views to keep map, SMS, push, and database costs predictable.

## Source Of Truth

- Customer discovery is address-based, not transient GPS-based.
- Booking creation requires a confirmed service address inside the active Vietnam HANDS service area.
- Every booking stores an immutable `BookingAddressSnapshot`.
- The booking service address is the operational source of truth for matching, service delivery, cancellation review, and admin reporting.
- Fresh customer GPS can be used as optional anti-mismatch evidence during booking creation. If supplied and it is 50km or more away from the selected service address, booking creation is rejected.
- Customers can browse the app from outside Vietnam, but they cannot create a booking outside the active service area.

## Customer App

- Do not continuously track customer location.
- On app open, use the last known location/address first.
- Refresh customer GPS only when the user explicitly needs it, such as choosing "use current location" or submitting a booking with a confirmed service address.
- Do not request customer GPS more often than every 15 minutes for normal foreground use.
- Address search uses Geoapify only after a 500 ms debounce and at least 3 query characters.
- Cache repeated normalized address searches in memory.
- Reverse geocode only when the customer selects or saves an address, not on every map movement or location update.
- After booking creation, do not track the customer for that booking.

## Partner App

- Request GPS when the partner logs in and goes online.
- Send one location update immediately after going online.
- While online without an active booking, refresh only every 60 minutes or after the partner moved at least 3000m.
- While assigned to an active booking, refresh at most every 30 minutes until the booking is completed or closed.
- Stop location updates when the partner goes offline, completes the booking, or the app is closed.
- Do not run background tracking.
- If GPS is denied, reuse the last valid stored partner location only; do not overwrite the server with fake/demo coordinates.

## Backend Guardrails

- The API must enforce partner location throttling even if the app sends updates too often.
- Current partner location is a short-lived Redis signal with a 90 minute TTL.
- Locations older than 90 minutes are stale for operations and matching.
- PostgreSQL should store only durable facts: booking address snapshots, selected customer addresses, and operational audit records when needed.
- Do not reverse geocode every partner location update.
- Do not store high-frequency location history unless a specific audit flow requires it.

## Admin Map And Analytics

- Admin overview maps must use Vietnam region aggregates, not individual customer or partner coordinates.
- Default admin map rendering should use static SVG, GeoJSON, or local mock shapes. Do not use paid external map tiles by default.
- Refresh aggregate admin map data at low frequency, such as 60 seconds or user-triggered navigation.
- Region stats should be keyed by `regionCode` and may include customer count, active customer count, online partner count, active booking count, completed booking count, cancellation count, and revenue.
- Admin usage dashboards should aggregate by today, yesterday, 7 days, this month, and all time. Avoid per-user realtime polling.

## Environment Variables

```dotenv
MAPTILER_API_KEY=
GEOAPIFY_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
PROVIDER_SEARCH_RADIUS_METERS=5000
PROVIDER_STALE_AFTER_MINUTES=90
PROVIDER_HIDE_AFTER_HOURS=24
```

Flutter local run:

```powershell
$env:MAPTILER_API_KEY="your-maptiler-key"
$env:GEOAPIFY_API_KEY="your-geoapify-key"
powershell -ExecutionPolicy Bypass -File C:\dev\massage-on-demand-vn\infra\scripts\run-hands-emulator.ps1 -App customer
```

## Supabase SQL

Use [location-schema.sql](/C:/dev/massage-on-demand-vn/infra/supabase/location-schema.sql) only if HANDS later stores map/location data directly in Supabase.

The current MVP implementation uses the NestJS API and PostgreSQL/PostGIS-compatible schema so mobile apps do not need direct Supabase access for business writes.

## Cost Controls

- No Directions API.
- No Routing API.
- No continuous customer GPS tracking.
- No continuous WebSocket GPS streaming.
- No background location updates.
- No reverse geocoding on every location update.
- Partner idle location refresh is 60 minutes or 3000m movement.
- Partner active-booking location refresh is at most 30 minutes.
- Nearby partner search hides stale locations instead of polling continuously.
- Geoapify search runs only after 500 ms debounce and reuses cached results.
