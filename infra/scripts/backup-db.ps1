param(
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available on PATH."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $OutputDir "massage-vn-$timestamp.dump"
$containerPath = "/tmp/massage-vn-$timestamp.dump"
$containerId = (& docker compose -f $ComposeFile ps -q postgres).Trim()
if (-not $containerId) {
  throw "PostgreSQL container is not running for compose file: $ComposeFile"
}

Write-Host "Creating database backup at $outputPath"
try {
  & docker compose -f $ComposeFile exec -T postgres pg_dump -U massage -d massage_vn -Fc "--file=$containerPath"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
  & docker cp "${containerId}:$containerPath" $outputPath
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }
  if ((Get-Item -LiteralPath $outputPath).Length -eq 0) { throw "Backup file is empty: $outputPath" }
} finally {
  & docker compose -f $ComposeFile exec -T postgres rm -f $containerPath | Out-Null
}
Write-Host "Backup completed: $outputPath"
