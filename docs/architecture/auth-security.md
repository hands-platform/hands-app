# Auth And Role Security

## MVP Auth

- `POST /api/auth/request-otp` generates a cryptographic six-digit OTP, stores the five-minute
  challenge in Redis, and returns a fixed `DEV_OTP` only when `NODE_ENV` is `development` or `test`
  and `MOBILE_AUTH_ALLOW_DEV_OTP=true`. Shared and production environments ignore the switch.
- OTP delivery is handled by `OtpDeliveryService`, which supports a local `dev` provider and an HTTP SMS-provider adapter.
- `POST /api/auth/verify-otp` validates the Redis OTP, consumes it after successful verification, and returns signed access/refresh tokens.
- Phone-level resend cooldown, hashed phone/prefix/global daily send budgets, and failed-attempt
  limits are enforced before issuing a mobile session.
- If Redis is unavailable in local development, the API uses an in-memory OTP fallback so the demo
  flow remains usable. Production fails closed.
- `POST /api/auth/refresh` verifies the refresh-token signature and `tokenType=refresh`, consumes the
  presented token hash, and rotates to a new refresh token.
- `POST /api/auth/logout` stores the SHA-256 refresh-token hash in the revocation set until the token
  expires. Production refresh and logout operations fail closed when Redis cannot enforce that
  state.
- `POST /api/auth/supabase/exchange` converts a verified Supabase Auth access token into the same HANDS access/refresh token shape used by the existing API.
- Protected REST routes require `Authorization: Bearer <accessToken>`.
- Auth routes are protected by a small in-memory rate limit in the API process.

## Roles

- `CUSTOMER` can manage customer profile, create bookings, select providers, and write reviews.
- `PROVIDER` can go online/offline, update location, participate/respond to bookings, and update service lifecycle.
- `ADMIN` can review providers, inspect users/bookings/payments/reviews, create services, and refund payments.
- Supabase exchange does not trust a mobile-requested role by itself. Provider exchange requires a token/provider mapping that is already trusted by the backend, either through Supabase metadata set by a trusted process or an existing local provider account linked by phone.
- OTP, refresh, and Supabase mobile exchange issue only the selected active `CUSTOMER` or `PROVIDER`
  role in the session token. A dual Customer/Partner account keeps both memberships in the database,
  but one mobile token cannot inherit both roles.
- A local user containing `ADMIN` or any other non-mobile role cannot be linked to or exchanged
  through the mobile OTP/Supabase path. Phone collisions with an Admin operator fail closed instead
  of converting that identity into a mobile session.
- Admin partner approval attempts a server-side Supabase Auth metadata sync when `SUPABASE_SERVICE_ROLE_KEY` is configured and the user is linked to Supabase. Missing keys or missing Supabase user links are recorded as skipped audit events rather than blocking local MVP operations.

## Remaining Release Hardening

- Configure a real Vietnam SMS provider behind `SMS_PROVIDER=vonage|viettel|fpt|custom`, `SMS_API_URL`, `SMS_API_KEY`, `SMS_API_SECRET`, and `SMS_SENDER_ID`.
- Move rate limiting to Redis or a gateway before horizontal scaling.
- Re-run OTP delivery, refresh/logout race, and provider throttling checks against the hosted
  environment after server and SMS-provider setup.
