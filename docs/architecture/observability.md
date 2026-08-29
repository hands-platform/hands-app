# Observability

The MVP includes basic operational diagnostics for Docker Compose deployments.

## Health

- `GET /api/health`
- `GET /api/health/ready`

Readiness checks database, Redis, and storage configuration.

## Log Collection

PowerShell:

```powershell
.\infra\scripts\collect-logs.ps1
```

Shell:

```bash
sh infra/scripts/collect-logs.sh
```

By default, logs from the last two hours are collected for:

- `api`
- `admin_web`
- `nginx`
- `postgres`
- `redis`
- `minio`
- `minio-init`

Output is written under `logs/diagnostics-YYYYMMDD-HHMMSS/` and ignored by Git.

## Request IDs

The API adds or forwards `x-request-id` for every HTTP request.

- If the client sends `x-request-id`, the API preserves it.
- Otherwise the API generates a UUID.
- The response exposes `x-request-id`.
- Structured JSON request logs include `requestId`, method, path, status code, and duration.
- Error responses include `requestId`, path, timestamp, and status code.

Nginx forwards its `$request_id` to API and Admin Web upstreams.

## Settlement Repair Dry-Run Fan-Out

`booking_settlement_gap_dry_run_fanout` is emitted for every Historical Settlement Repair dry-run, including failed attempts. It records the track, evaluated count, candidate query count, preview call/batch count, candidate/preview/total duration, truncation, status, and a failure stage without logging booking IDs or financial evidence.

Collect a seven-day production window and build the decision report with the existing Compose diagnostics path:

```powershell
npm.cmd run logs:collect -- -Since 168h
node infra/scripts/settlement-dry-run-fanout-report.mjs logs/diagnostics-YYYYMMDD-HHMMSS/api.log
```

The report groups samples by track and evaluated-count bucket, then returns p50/p95/p99 latency, error and truncation rates, candidate query counts, preview calls, and one decision:

- `INSUFFICIENT_SAMPLES`: fewer than 20 successful samples; keep collecting.
- `INVESTIGATE_FAILURES`: at least one failed dry-run; resolve the failure before a performance redesign.
- `INVESTIGATE_QUERY_REGRESSION`: candidate query count is no longer the expected two queries.
- `REVIEW_BULK_API`: at least 20 successful samples and p95 exceeds 1,000 ms; review a separate bulk preview API contract.
- `KEEP_CURRENT_FANOUT`: enough successful samples, no failures/query regression, and p95 is within budget.

Use a fresh seven-day window after deploying the event contract. Rolling-deploy legacy success events are accepted by the parser, but older code did not emit failed attempts and therefore cannot provide a trustworthy historical error rate.

## Security Headers And Rate Limit Signals

The API sets basic security headers:

- `x-content-type-options`
- `x-frame-options`
- `referrer-policy`
- `permissions-policy`
- `content-security-policy`
- `strict-transport-security` in production

Auth endpoints return rate-limit headers:

- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `x-ratelimit-reset`
- `retry-after` on `429`

## Production Next Steps

- Move auth rate limiting to Redis or a gateway if multiple API replicas are used.
- Forward logs to a managed provider before scaling beyond a single VPS.
- Add uptime checks against `/api/health/ready`.
