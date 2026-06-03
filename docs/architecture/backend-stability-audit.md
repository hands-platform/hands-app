# Backend Stability Audit

Last reviewed: 2026-06-03

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

- Partner accept/reject responses are now allowed only while the booking is still `OPEN_MATCHING` and not expired.
- Selected partners can no longer complete a booking before the service reaches `IN_SERVICE`.
- Partner lifecycle status changes now reject invalid jumps, such as marking `ARRIVED` after completion.
- Production Docker Compose no longer contains default database or MinIO passwords. Required production secrets must be supplied through environment variables.
- Secret leak scanning now checks `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD`.

## Current Backend Position

- Customer booking cancellation is blocked after partner commitment and routed to admin review.
- Negative partner wallets block marketplace join, direct accept, customer final selection, service start, and payout release.
- Negative partner wallets do not create marketplace participant records when a join is blocked.
- Real marketplace participants remain stored for admin visibility.
- Payment callbacks are public by necessity, but payment provider signature verification must be completed before real MoMo/VNPay launch.
- Firebase push is intentionally not part of the active MVP path; notifications are currently in-app with future OneSignal expansion.

## Follow-Up Before Production

- Replace all local JWT secrets and disable development OTP values in production environments.
- Complete MoMo/VNPay callback signature verification and replay protection.
- Add API tests for invalid partner response timing, service-completion ordering, and negative-wallet marketplace join rejection.
- Confirm production storage uses separate private and public buckets.
- Rotate any external keys that were ever pasted into chat before using staging for real user data.
