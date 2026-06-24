param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$statePath = Join-Path $RepoRoot "logs\hands-local\state.json"
if (-not (Test-Path $statePath)) {
  Write-Host "HANDS local services are not started"
  exit 0
}

$state = Get-Content -Raw $statePath | ConvertFrom-Json

function Get-OptionalProcessById {
  param([object]$ProcessId)

  if ($null -eq $ProcessId -or [string]::IsNullOrWhiteSpace([string]$ProcessId)) {
    return $null
  }

  return Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue
}

function Get-LatestFileWriteTimeUtc {
  param(
    [string]$Path,
    [string[]]$Extensions
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  $latest = Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $Extensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if (-not $latest) {
    return $null
  }

  return $latest.LastWriteTimeUtc
}

function Format-OptionalDateTime {
  param([object]$Value)

  if ($null -eq $Value) {
    return $null
  }

  return ([datetime]$Value).ToString("o")
}

function Get-ApiBuildStatus {
  param([string]$Root)

  $apiSourcePath = Join-Path $Root "apps\api\src"
  $apiDistMainPath = Join-Path $Root "apps\api\dist\main.js"
  $sourceUpdatedAt = Get-LatestFileWriteTimeUtc -Path $apiSourcePath -Extensions @(".ts", ".js", ".json")
  $distMain = Get-Item -LiteralPath $apiDistMainPath -ErrorAction SilentlyContinue
  $distUpdatedAt = if ($distMain) { $distMain.LastWriteTimeUtc } else { $null }

  if ($null -eq $sourceUpdatedAt) {
    return [pscustomobject]@{
      freshness = "unknown"
      message = "API source timestamp could not be determined."
      sourceUpdatedAt = $null
      distUpdatedAt = Format-OptionalDateTime $distUpdatedAt
    }
  }

  if ($null -eq $distUpdatedAt) {
    return [pscustomobject]@{
      freshness = "missing"
      message = "API dist/main.js is missing. Run npm.cmd run build --workspace @massage-vn/api before starting API from dist."
      sourceUpdatedAt = Format-OptionalDateTime $sourceUpdatedAt
      distUpdatedAt = $null
    }
  }

  if ($sourceUpdatedAt -gt $distUpdatedAt) {
    return [pscustomobject]@{
      freshness = "stale"
      message = "API source is newer than dist/main.js. Rebuild and restart the API before relying on live smoke results."
      sourceUpdatedAt = Format-OptionalDateTime $sourceUpdatedAt
      distUpdatedAt = Format-OptionalDateTime $distUpdatedAt
    }
  }

  return [pscustomobject]@{
    freshness = "fresh"
    message = "API dist/main.js is at least as new as API source."
    sourceUpdatedAt = Format-OptionalDateTime $sourceUpdatedAt
    distUpdatedAt = Format-OptionalDateTime $distUpdatedAt
  }
}

$apiProcess = Get-OptionalProcessById $state.apiPid
$adminProcess = Get-OptionalProcessById $state.adminPid
$apiBuildStatus = Get-ApiBuildStatus -Root $RepoRoot

[pscustomobject]@{
  appName = $state.appName
  coverage = $state.coverage
  repoRoot = $state.repoRoot
  apiPort = $state.apiPort
  adminPort = $state.adminPort
  apiRunning = [bool]$apiProcess
  adminRunning = [bool]$adminProcess
  startedAt = $state.startedAt
  apiBuildFreshness = $apiBuildStatus.freshness
  apiBuildMessage = $apiBuildStatus.message
  apiSourceUpdatedAt = $apiBuildStatus.sourceUpdatedAt
  apiDistUpdatedAt = $apiBuildStatus.distUpdatedAt
  apiHealth = "http://localhost:$($state.apiPort)/api/health"
  adminUrl = "http://localhost:$($state.adminPort)"
} | ConvertTo-Json -Depth 5
