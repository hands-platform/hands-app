# Auth And Role Security

## MVP Auth

- `POST /api/auth/request-otp` stores a 5-minute OTP in Redis and returns `DEV_OTP` for local testing outside production.
- OTP delivery is handled by `OtpDeliveryService`, which supports a local `dev` provider and an HTTP SMS-provider adapter.
- `POST /api/auth/verify-otp` validates the Redis OTP, consumes it after successful verification, and returns signed access/refresh tokens.
- If Redis is unavailable in local development, the API uses an in-memory OTP fallback so the demo flow remains usable.
- `POST /api/auth/refresh` verifies the refresh-token signature and `tokenType=refresh`.
- `POST /api/auth/supabase/exchange` converts a verified Supabase Auth access token into the same HANDS access/refresh token shape used by the existing API.
- Protected REST routes require `Authorization: Bearer <accessToken>`.
- Auth routes are protected by a small in-memory rate limit in the API process.

## Roles

- `CUSTOMER` can manage customer profile, create bookings, select providers, and write reviews.
- `PROVIDER` can go online/offline, update location, join/respond to bookings, and update service lifecycle.
- `ADMIN` can review providers, inspect users/bookings/payments/reviews, create services, and refund payments.
- Supabase exchange does not trust a mobile-requested role by itself. Provider exchange requires a token/provider mapping that is already trusted by the backend, either through Supabase metadata set by a trusted process or an existing local provider account linked by phone.
- Admin partner approval attempts a server-side Supabase Auth metadata sync when `SUPABASE_SERVICE_ROLE_KEY` is configured and the user is linked to Supabase. Missing keys or missing Supabase user links are recorded as skipped audit events rather than blocking local MVP operations.

## Next Hardening

- Configure a real Vietnam SMS provider behind `SMS_PROVIDER=http`, `SMS_API_URL`, `SMS_API_KEY`, and `SMS_SENDER_ID`.
- Move rate limiting to Redis or a gateway before horizontal scaling.
- Store hashed refresh tokens and support revocation.
- Add ownership checks so customers can only read their own bookings and providers can only update assigned bookings.
- Add admin audit log writes to every moderation/refund action.
