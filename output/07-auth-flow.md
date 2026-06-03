# Auth Flow

## Current MVP

- NestJS owns login session policy and role authorization.
- Mobile apps use phone OTP style screens and API-issued tokens for local/staging development.
- Admin uses protected server-side API calls.
- Supabase Auth is the target infrastructure for production phone OTP, but business authorization remains in NestJS.

## Roles

- `CUSTOMER`
- `PROVIDER` internally, shown as Partner in UI
- `ADMIN`

## Deferred External Setup

- Production SMS provider, such as Vonage, is deferred until account credentials and OTP E2E verification are ready.
- Do not reintroduce Firebase Auth.
- Do not let mobile screens call Supabase directly for business writes.

## Security Requirements

- Access tokens must be sent as Bearer tokens.
- Refresh/session handling should be abstracted behind repositories/use cases in Flutter.
- Admin routes require admin role.
- Partner routes require partner ownership or admin role.
- Customer routes require customer ownership or admin role.
