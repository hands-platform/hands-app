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

function Test-LocalPortListening {
  param([object]$Port)

  if ($null -eq $Port -or [string]::IsNullOrWhiteSpace([string]$Port)) {
    return $false
  }

  $connection = Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  return [bool]$connection
}

function Get-HttpProbeStatus {
  param(
    [string]$Url,
    [int[]]$AllowedStatusCodes = @(200),
    [int]$TimeoutSeconds = 2
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -ErrorAction Stop
    $statusCode = [int]$response.StatusCode
    return [pscustomobject]@{
      ok = $AllowedStatusCodes -contains $statusCode
      status = $statusCode
      error = $null
    }
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return [pscustomobject]@{
      ok = $null -ne $statusCode -and $AllowedStatusCodes -contains $statusCode
      status = $statusCode
      error = $_.Exception.Message
    }
  }
}

$apiProcess = Get-OptionalProcessById $state.apiPid
$adminProcess = Get-OptionalProcessById $state.adminPid
$apiBuildStatus = Get-ApiBuildStatus -Root $RepoRoot
$apiHealthUrl = "http://localhost:$($state.apiPort)/api/health"
$adminUrl = "http://localhost:$($state.adminPort)"
$apiPortListening = Test-LocalPortListening $state.apiPort
$adminPortListening = Test-LocalPortListening $state.adminPort
$apiHealthProbe = Get-HttpProbeStatus -Url $apiHealthUrl
$adminProbe = Get-HttpProbeStatus -Url $adminUrl -AllowedStatusCodes @(200, 307, 308, 404) -TimeoutSeconds 10

[pscustomobject]@{
  appName = $state.appName
  coverage = $state.coverage
  repoRoot = $state.repoRoot
  apiPort = $state.apiPort
  adminPort = $state.adminPort
  apiRunning = [bool]$apiProcess -or $apiPortListening
  adminRunning = [bool]$adminProcess -or $adminPortListening
  apiPortListening = $apiPortListening
  adminPortListening = $adminPortListening
  apiHealthOk = [bool]$apiHealthProbe.ok
  apiHealthStatus = $apiHealthProbe.status
  apiHealthError = $apiHealthProbe.error
  adminReachable = [bool]$adminProbe.ok
  adminHttpStatus = $adminProbe.status
  adminHttpError = $adminProbe.error
  startedAt = $state.startedAt
  apiBuildFreshness = $apiBuildStatus.freshness
  apiBuildMessage = $apiBuildStatus.message
  apiSourceUpdatedAt = $apiBuildStatus.sourceUpdatedAt
  apiDistUpdatedAt = $apiBuildStatus.distUpdatedAt
  apiHealth = $apiHealthUrl
  adminUrl = $adminUrl
} | ConvertTo-Json -Depth 5
