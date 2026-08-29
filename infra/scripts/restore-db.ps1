param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$ComposeFile = "docker-compose.prod.yml",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $Force) {
  throw "Restore is destructive. Re-run with -Force after confirming BackupPath and target database."
}

if (-not (Test-Path $BackupPath)) {
  throw "Backup file not found: $BackupPath"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available on PATH."
}

$containerId = (& docker compose -f $ComposeFile ps -q postgres).Trim()
if (-not $containerId) {
  throw "PostgreSQL container is not running for compose file: $ComposeFile"
}
$containerPath = "/tmp/massage-vn-restore-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"

Write-Host "Restoring database from $BackupPath"
try {
  & docker cp $BackupPath "${containerId}:$containerPath"
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }
  & docker compose -f $ComposeFile exec -T postgres pg_restore -U massage -d massage_vn --clean --if-exists --no-owner $containerPath
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} finally {
  & docker compose -f $ComposeFile exec -T postgres rm -f $containerPath | Out-Null
}
Write-Host "Restore completed."
