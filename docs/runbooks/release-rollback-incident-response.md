# Release Rollback And Incident Response

This runbook connects HANDS release gates, application rollback, financial mutation safety, queue recovery, and database restore evidence. It does not replace the incident commander's judgement or authorize a destructive database restore.

Use `Asia/Ho_Chi_Minh` for operational timestamps.

## Release Record

Before deployment, record:

- release commit and immutable application artifact or image identifiers;
- previous deployable artifact or commit;
- included Prisma migration directories and migration check result;
- environment validation, focused tests, scope verification, and strict readiness results;
- backup path, timestamp, checksum, retention location, and latest successful isolated restore drill;
- operator, reviewer, incident commander, and finance decision-maker roles;
- known non-blocking risks and every approved exception.

Do not deploy when a blocking gate is unresolved. Missing production DNS, credentials, approval governance, backup evidence, or restore evidence must not be converted into a warning merely because application tests pass.

## Incident Entry

1. Record detection time, affected environment, release identifier, observed symptoms, and the first correlation or request IDs.
2. Assign the incident commander role and the operator responsible for evidence capture.
3. Freeze new deployments. When financial integrity may be affected, also pause operator financial mutations and automated closeout or payout work through the existing operational controls.
4. Preserve evidence before restarting services:

   ```powershell
   npm.cmd run logs:collect
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs --no-color --timestamps api admin_web nginx
   ```

5. Record database readiness, Redis readiness, queue health, failed/stalled jobs, and external gateway status without replaying callbacks or jobs.

## Decision Tree

### Application-only regression

Use application rollback when the fault is in API, Admin Web, Nginx, or worker code and existing data remains trustworthy.

1. Stop opening traffic to the affected release or place the existing edge in maintenance mode.
2. Keep PostgreSQL, Redis, and object storage intact unless evidence shows they are part of the failure.
3. Deploy the recorded previous application artifact. Do not rebuild an unrecorded working tree and call it a rollback.
4. Do not run down migrations. Prisma migrations are forward-only by default; use a reviewed forward fix when the new schema is incompatible with the previous application.
5. Verify `/api/health/ready`, Admin login and permission denial, realtime authentication, and non-mutating reads before reopening traffic.
6. Run mutating smoke procedures only in a disposable or explicitly approved staging environment.

### Queue or external-side-effect failure

Use recovery queues and idempotent operations when PostgreSQL state is authoritative but Redis, BullMQ, notifications, or a payment/refund status job failed.

1. Do not delete Redis keys, jobs, or audit evidence as a first response.
2. Compare the database mutation, queue registration, delivery/status evidence, retry count, and external provider reference.
3. Requeue or retry only through the existing Admin recovery control and only after checking its idempotency key or source key.
4. Never resend a payment callback, finalize a refund, create an earning, or release a payout solely to make queue counts clear.
5. Record the recovery action, actor, reason, source record, job identifier, and resulting audit evidence.

### Suspected financial or data corruption

1. Keep the financial mutation freeze in place.
2. Preserve database, application, queue, gateway, and audit evidence.
3. Identify the earliest trustworthy point and affected invariants before choosing forward repair or restore.
4. Prefer a reviewed compensating entry, reversal, conditional repair, or forward migration when original evidence can remain intact.
5. Treat database restore as a last-resort incident decision. It requires an approved recovery point, verified backup checksum, successful isolated restore evidence, explicit impact analysis for records created after that point, and separate recovery of object storage.
6. Never run `restore-db.*`, Prisma reset, development migration, seed, cleanup, or backfill commands against production during diagnosis.

## Reopen Gates

Traffic or financial mutations may resume only after the responsible roles confirm:

- API, Admin Web, PostgreSQL, Redis, queue, storage, and required external-service readiness;
- authentication, logout/revocation, permission denial, and realtime revocation behavior;
- booking state, payment, refund, wallet, earning, payout, cash settlement, and accounting invariants relevant to the incident;
- no unresolved duplicate external side effect;
- failed/stalled jobs and recovery queues are understood;
- audit evidence contains the incident and every manual action;
- monitoring and logs show the recovered release is stable.

## Closeout Evidence

Record the timeline, user and financial impact, root cause, containment, rollback or repair commands, artifact identifiers, migration state, backup/restore evidence, validation results, remaining risk, and follow-up owner roles. Keep secrets, OTP values, tokens, full financial evidence, and personal data out of the incident summary; reference protected evidence by safe identifier.

If a restore was used, attach the completed evidence defined in [Backup And Restore](../architecture/backup-restore.md). If no restore was used, state that explicitly.
