$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"

$databaseUrl = [Environment]::GetEnvironmentVariable("HANDS_MCP_POSTGRES_URL", "Process")
if (-not $databaseUrl) {
  $databaseUrl = [Environment]::GetEnvironmentVariable("HANDS_MCP_POSTGRES_URL", "User")
}
if (-not $databaseUrl) {
  $databaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
}
if (-not $databaseUrl -and (Test-Path $envPath)) {
  $line = Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
  if ($line) {
    $databaseUrl = ($line -replace "^DATABASE_URL=", "").Trim().Trim('"').Trim("'")
  }
}

if (-not $databaseUrl) {
  [Console]::Error.WriteLine("PostgreSQL MCP startup failed: DATABASE_URL or HANDS_MCP_POSTGRES_URL is required.")
  exit 1
}

& npx.cmd -y @modelcontextprotocol/server-postgres $databaseUrl
