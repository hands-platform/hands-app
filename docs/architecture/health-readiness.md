# Health And Readiness

The API exposes two public operational checks:

- `GET /api/health` confirms the Nest app is running.
- `GET /api/health/ready` checks database, Redis, and storage configuration readiness.
- `GET /api/health/external` checks external account/API-key readiness without exposing secret values.

## Readiness Checks

- `database`: runs `SELECT 1` through Prisma.
- `redis`: sends `PING` through the Redis state service.
- `storage`: verifies S3-compatible environment variables are configured for MinIO, Cloudflare R2, or Supabase Storage S3.

Storage can be in `placeholder` mode for local MVP flows. Readiness only fails for database or Redis failures because placeholder storage is intentionally supported for development.

## External Readiness Scope

`GET /api/health/external` is secret-safe. It only returns configured key names, missing key names, setup scope, and next verification commands.

- `CURRENT_STAGE`: blocks current local/staging E2E when not ready. Today this mainly covers Supabase core and MapTiler/Geoapify map setup.
- `DEFERRED`: tracked for production readiness, but intentionally parked until the right phase. Examples: Supabase Phone Auth, SMS, payments, OS push, Android release signing, and production storage/CDN.

Each external check can include:

- `operatorAction`: what the operator should do next without exposing secret values.
- `commands`: repository commands to verify that specific setup area.
- `secretSafe`: confirms the response does not print actual secrets.

## Usage

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/health/ready
Invoke-RestMethod http://localhost:3000/api/health/external
```

The E2E smoke script calls both checks before exercising product flows. Admin Setup mirrors the same endpoint so operators can see current blockers, deferred production work, and exact verification commands in one place.
