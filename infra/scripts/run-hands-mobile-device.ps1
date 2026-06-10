param(
  [ValidateSet("customer", "provider")]
  [string]$App,
  [string]$DeviceId,
  [string]$RepoRoot = "C:\dev\massage-on-demand-vn",
  [int]$ApiPort = 3000
)

$ErrorActionPreference = "Stop"

function Import-DotEnvIfPresent {
  param([string]$Root)

  $envPath = Join-Path $Root ".env"
  if (-not (Test-Path $envPath)) {
    return
  }

  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      return
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim().Trim("'").Trim('"')
    if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

function Get-TargetDeviceId {
  param([string]$PreferredDeviceId)

  $deviceLines = (& adb devices) | Select-Object -Skip 1
  $devices = @()

  foreach ($line in $deviceLines) {
    if (-not $line.Trim()) {
      continue
    }

    $parts = $line -split "\s+"
    if ($parts.Length -ge 2 -and $parts[1] -eq "device") {
      $devices += $parts[0]
    }
  }

  if ($PreferredDeviceId) {
    if ($devices -notcontains $PreferredDeviceId) {
      throw "Requested device '$PreferredDeviceId' is not connected. Connected devices: $($devices -join ', ')"
    }

    return $PreferredDeviceId
  }

  if ($devices.Count -eq 0) {
    throw "No Android device is connected. Connect a phone with USB debugging enabled, approve the RSA prompt, then rerun this script."
  }

  if ($devices.Count -gt 1) {
    throw "Multiple Android devices are connected. Rerun with -DeviceId one of: $($devices -join ', ')"
  }

  return $devices[0]
}

Import-DotEnvIfPresent -Root $RepoRoot

$appDir = switch ($App) {
  "customer" { Join-Path $RepoRoot "apps\customer_app" }
  "provider" { Join-Path $RepoRoot "apps\provider_app" }
}
$mapTilerApiKey = $env:MAPTILER_API_KEY
$geoapifyApiKey = $env:GEOAPIFY_API_KEY
$authBackend = $env:AUTH_BACKEND
$supabaseUrl = $env:SUPABASE_URL
$supabaseAnonKey = $env:SUPABASE_ANON_KEY

if (-not (Test-Path $appDir)) {
  throw "App directory not found: $appDir"
}

$targetDeviceId = Get-TargetDeviceId -PreferredDeviceId $DeviceId

Write-Host "Using Android device: $targetDeviceId"
Write-Host "Configuring adb reverse tcp:$ApiPort -> tcp:$ApiPort"
& adb -s $targetDeviceId reverse "tcp:$ApiPort" "tcp:$ApiPort"
if ($LASTEXITCODE -ne 0) {
  throw "adb reverse failed for device $targetDeviceId"
}

Push-Location $appDir
try {
  $flutterArgs = @(
    "run",
    "-d",
    $targetDeviceId,
    "--dart-define=API_BASE_URL=http://127.0.0.1:$ApiPort/api",
    "--dart-define=SOCKET_BASE_URL=http://127.0.0.1:$ApiPort"
  )
  if ($mapTilerApiKey) {
    $flutterArgs += "--dart-define=MAPTILER_API_KEY=$mapTilerApiKey"
  }
  if ($geoapifyApiKey) {
    $flutterArgs += "--dart-define=GEOAPIFY_API_KEY=$geoapifyApiKey"
  }
  if ($authBackend) {
    $flutterArgs += "--dart-define=AUTH_BACKEND=$authBackend"
  }
  if ($supabaseUrl) {
    $flutterArgs += "--dart-define=SUPABASE_URL=$supabaseUrl"
  }
  if ($supabaseAnonKey) {
    $flutterArgs += "--dart-define=SUPABASE_ANON_KEY=$supabaseAnonKey"
  }
  & flutter @flutterArgs
} finally {
  Pop-Location
}
