# Backup And Restore

The MVP includes simple PostgreSQL backup and restore scripts for Docker Compose deployments.

## Backup

PowerShell:

```powershell
.\infra\scripts\backup-db.ps1
```

Shell:

```bash
sh infra/scripts/backup-db.sh
```

Backups are written to `backups/` and are ignored by Git.

## Restore

Restore is destructive and requires an explicit force flag.

PowerShell:

```powershell
.\infra\scripts\restore-db.ps1 -BackupPath backups/massage-vn-YYYYMMDD-HHMMSS.dump -Force
```

Shell:

```bash
FORCE=1 sh infra/scripts/restore-db.sh backups/massage-vn-YYYYMMDD-HHMMSS.dump
```

## Production Notes

- Keep off-server backups for real production.
- Test restore regularly on staging.
- Back up object storage separately; database backups only preserve `FileAsset` metadata and object keys.
- Run `npm.cmd run api:smoke` after staging restores.

For a local, disposable verification of the object-storage restore procedure, run:

```powershell
npm.cmd run storage:restore-smoke
```

This drill uses only a local Docker engine. It writes one private and one public fixture to an ephemeral
MinIO source, mirrors both buckets to a separate logical backup volume, removes the source container and
volume, restores into a fresh MinIO target, and verifies the restored object bytes and SHA-256 evidence.
All generated Docker resources use a unique `hands-storage-restore-*` prefix and are removed in `finally`.
It never connects to configured staging or production object storage. Run the provider-specific backup
and restore procedure separately before release, retaining the evidence listed below.

## Isolated Restore Drill

Never point a restore drill at production, a shared developer database, or a staging database used by another operator. The operator must first verify that the target is disposable and isolated, then record that verification in the drill evidence.

1. Record the backup path, creation time, byte size, and SHA-256 checksum.
2. Record the isolated host or Compose project, database name, and the evidence that no production or shared endpoint uses it.
3. Start a clean staging PostgreSQL target with the same major PostgreSQL and PostGIS versions as production.
4. Run the restore script only after checking the backup and target again. The explicit `-Force` or `FORCE=1` flag is the final destructive-operation acknowledgement, not proof that the target is safe.
5. Run Prisma schema validation and migration status checks without applying development migrations.
6. Start API, Admin Web, Redis, and storage dependencies against the restored staging target.
7. Run readiness checks. Run mutating lifecycle smoke tests only because this target has already been verified disposable.
8. Verify representative booking, payment, refund, wallet, payout, notification, audit-log, and file-metadata records. Verify object-storage recovery separately.
9. Destroy or quarantine the isolated target according to the environment policy after evidence is retained.

PowerShell evidence helpers:

```powershell
Get-Item backups/massage-vn-YYYYMMDD-HHMMSS.dump | Select-Object FullName, Length, LastWriteTimeUtc
Get-FileHash backups/massage-vn-YYYYMMDD-HHMMSS.dump -Algorithm SHA256
npm.cmd exec --workspace @massage-vn/api -- prisma validate
npm.cmd exec --workspace @massage-vn/api -- prisma migrate status
```

The Prisma commands require the isolated target's `DATABASE_URL`. Do not substitute a production URL merely to make validation pass.

## Restore Drill Evidence

Keep the following with the release or incident record:

- drill date and timezone (`Asia/Ho_Chi_Minh`);
- operator and reviewer roles;
- source backup checksum and retention location;
- disposable-target verification;
- PostgreSQL, PostGIS, Prisma, and application versions;
- restore start/end time and command exit status;
- readiness and smoke command results;
- sampled record checks and object-storage result;
- cleanup or quarantine confirmation;
- deviations, failed checks, and follow-up owner role.

A script syntax check or successful backup creation is not a restore drill. Production recovery remains blocked until an isolated restore has completed and the evidence above has been reviewed.

For production recovery decisions, follow [Release Rollback And Incident Response](../runbooks/release-rollback-incident-response.md).
