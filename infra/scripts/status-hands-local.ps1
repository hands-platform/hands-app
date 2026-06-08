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

$apiProcess = Get-OptionalProcessById $state.apiPid
$adminProcess = Get-OptionalProcessById $state.adminPid

[pscustomobject]@{
  appName = $state.appName
  coverage = $state.coverage
  repoRoot = $state.repoRoot
  apiPort = $state.apiPort
  adminPort = $state.adminPort
  apiRunning = [bool]$apiProcess
  adminRunning = [bool]$adminProcess
  startedAt = $state.startedAt
  apiHealth = "http://localhost:$($state.apiPort)/api/health"
  adminUrl = "http://localhost:$($state.adminPort)"
} | ConvertTo-Json -Depth 5
