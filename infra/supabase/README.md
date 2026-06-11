# HANDS Supabase Setup

This folder contains the Supabase staging schema for the HANDS Firebase DB/Auth-free migration.
FCM remains the only allowed Firebase surface, and only for Android/iOS OS push. Firebase Realtime Database, Firestore, Firebase Auth, and Firebase Storage are not part of the MVP.

Use the generated bundle for staging setup instead of pasting individual SQL files one by one.

## Recommended Staging Flow

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run setup:doctor
npm.cmd run supabase:sql:pack
```

Then open this generated file and paste it into the Supabase SQL Editor:

```text
C:\dev\massage-on-demand-vn\infra\supabase\.generated\hands-staging-setup.sql
```

The generated bundle applies files in this order:

1. `hands-core-schema.sql`
2. `storage-schema.sql`

`location-schema.sql` is intentionally excluded from the bundle. It is an early standalone draft; the current core schema already includes `provider_locations`, `customer_selected_locations`, and `nearby_providers`.

If the generated SQL was applied before PostgREST role grants were added and REST requests return `42501 permission denied for table`, apply this one-time patch in the Supabase SQL Editor:

```text
C:\dev\massage-on-demand-vn\infra\supabase\patches\2026-05-23-postgrest-role-grants.sql
```

## After Applying SQL

Set these values in the API environment:

```dotenv
AUTH_BACKEND=nest
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_JWT_SECRET=<project-jwt-secret>
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-server-only>
```

Keep `AUTH_BACKEND=nest` until Supabase Phone Auth and the API exchange smoke test pass. Switch to `AUTH_BACKEND=supabase` only for the Supabase OTP E2E pass.

## Verification

```powershell
npm.cmd run supabase:schema:check
npm.cmd run supabase:sql:pack
npm.cmd run external:check:supabase
```

`external:check:supabase` checks core Supabase URL, anon key, JWT secret, and service role values. Phone Auth is intentionally separate and should only be checked when the chosen SMS provider/Supabase SMS E2E starts:

```powershell
npm.cmd run external:check:supabase-auth
```

After the API is running with `SUPABASE_JWT_SECRET`:

```powershell
npm.cmd run auth:supabase-smoke
```

## Production Safety

- Never commit Supabase secrets.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Test on a fresh staging project before touching any production-like project.
- Do not run destructive SQL against real data until backup and restore have been tested.
