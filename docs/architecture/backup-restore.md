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
