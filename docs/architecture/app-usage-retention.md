# App usage event retention

`AppUsageEvent` is the short-lived operational evidence source for recent activity and event-level debugging.
`AppUsageDailyAggregate` is the reporting source for period totals and customer activity rankings.

## Policy

- Raw events are retained for 90 days by default (`APP_USAGE_RAW_RETENTION_DAYS`).
- Daily aggregates are retained indefinitely by default (`APP_USAGE_DAILY_RETENTION_DAYS=0`).
- A positive daily retention value must be greater than or equal to the raw retention period.
- `APP_OPEN`, `SESSION_START`, and `PROVIDER_PROFILE_VIEW` update the raw event and daily aggregate in the same DB transaction.
- Client event IDs make retries idempotent; a retry must not increment either store.
- Vietnam calendar days use `Asia/Ho_Chi_Minh`.
- Raw deletion uses Vietnam midnight boundaries, so a retained day is never partially removed or rebuilt with a smaller count on a later run.
- Start Shift uses daily aggregates for selected-period totals and rankings. Only the current 15-minute activity signal reads raw events.
- Usage Overview uses daily aggregates for customer totals, lifecycle, rankings, retention, and daily trends. Raw events remain limited to event-level or hourly evidence.

## Operation

Preview candidates without deleting data:

```powershell
npm run app-usage:retention:check
```

Apply retention after reviewing the preview:

```powershell
npm run app-usage:retention:apply
```

The apply command rebuilds complete daily rows from retained raw evidence before deleting whole expired Vietnam days. In production it also requires
`APP_USAGE_RETENTION_CONFIRM=DELETE_OLD_APP_USAGE`. Scheduling is intentionally deferred until the production
server is provisioned; no local cron or deployment dependency is introduced.

## Historical aggregate repair

Preview the last 90 complete Vietnam calendar days:

```powershell
npm run app-usage:backfill:check
```

Apply only missing or mismatched aggregate rows after reviewing the preview:

```powershell
npm run app-usage:backfill:apply
```

Use `--from=YYYY-MM-DD --to=YYYY-MM-DD` to repair a specific range, or `--days=N` for a shorter rolling window.
The range is limited to 365 days and excludes the current Vietnam day by default so live increments cannot race an
absolute rebuild. `--include-current-day` is reserved for a controlled repair while event ingestion is stopped.
The command is idempotent, preserves aggregate-only rows whose raw evidence may already have expired, and verifies
that every source row matches after apply. A remote or production apply requires
`APP_USAGE_BACKFILL_CONFIRM=REBUILD_APP_USAGE_DAILY`.

The local integration smoke creates isolated historical raw events, repairs their aggregate, proves the second run is
a no-op, and removes the temporary user and all cascade-owned evidence:

```powershell
npm run app-usage:backfill:smoke
```
