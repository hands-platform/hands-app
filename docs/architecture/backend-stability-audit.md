# Backend Stability Audit

Last reviewed: 2026-06-04

## Scope

This pass checked the API against the current HANDS MVP authority:

- NestJS owns business authorization and booking decisions.
- Booking address snapshots are required for booking creation.
- Preferred partner first-pick remains a customer-confirmed flow.
- Marketplace participation uses booking-address distance and partner wallet gates.
- Customers select the final partner. There is no automatic assignment.
- Tips, customer scoring, and partner ranking are not part of the MVP.
- Admin is an Operations Command Center, not a CRM scoring layer.

## Fixed In This Pass

- Removed a stale Vietnam-only booking coordinate guard that lint correctly flagged as dead code. Global partner browsing remains allowed, while booking service addresses still use the active service-area gate.
- Nest-issued JWT access and refresh secrets now fail fast in production when the secret is missing or left as a placeholder. Local development keeps the explicit dev fallback.
- REST and Socket.IO CORS now use `CORS_ORIGINS` in production instead of allowing every origin with credentials. Local development remains permissive.
- Partner accept/reject responses are now allowed only while the booking is still `OPEN_MATCHING` and not expired.
- Selected partners can no longer complete a booking before the service reaches `IN_SERVICE`.
- Partner lifecycle status changes now reject invalid jumps, such as marking `ARRIVED` after completion.
- Production Docker Compose no longer contains default database or MinIO passwords. Required production secrets must be supplied through environment variables.
- Secret leak scanning now checks `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD`.

## Verification 2026-06-04

`npm.cmd run verify:local -- -WithServices` passed end-to-end:

- dev environment, script syntax, env, secret scan, final authority, policy coverage
- Prisma validate, migrate deploy, seed
- API build/typecheck, admin build/typecheck
- API readiness, API smoke, realtime smoke
- customer Flutter pub get, analyze, test
- provider Flutter pub get, analyze, test

Additional targeted checks also passed: `npm.cmd audit --audit-level=moderate`, `npm.cmd run admin:web-smoke`, and `npx.cmd prisma validate`.

## Current Backend Position

- Customer booking cancellation is blocked after partner commitment and routed to admin review.
- Negative partner wallets block marketplace participation and payout release.
- Negative partner wallets do not create marketplace participant records for blocked marketplace participation attempts.
- Real marketplace participants remain stored for admin visibility.
- Marketplace accept/reject responses now require an existing participant record, so partners must join before responding unless they are the first-pick invitee.
- Payment callbacks are public by necessity. MoMo/VNPay signature verification now runs when gateway secrets are configured, and production rejects missing callback secrets.
- Firebase push is intentionally not part of the active MVP path; notifications are currently in-app with future OneSignal expansion.
- Admin currently favors operator visibility over compact code. The largest files are booking detail, partner detail, dashboard, partner list, and booking monitor pages; they should be split into feature widgets and shared formatting helpers before adding another large Admin surface.
- The heaviest Prisma reads are intentionally on Admin pages, but several `include` trees should be converted to explicit `select` payloads as data grows.

## Follow-Up Before Production

- Set strong `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGINS` in every production-like environment.
- Disable development OTP values in production environments.
- Complete real MoMo/VNPay sandbox E2E after HANDS receives gateway credentials.
- Add focused unit tests around partner response timing and service-completion ordering.
- Confirm production storage uses separate private and public buckets.
- Rotate any external keys that were ever pasted into chat before using staging for real user data.
- Refactor Admin shared helpers first: `shortId`, `formatMoney`, `formatDate`, `relativeTime`, `bookingServiceLabel`, metadata readers, and reusable metric cards.
