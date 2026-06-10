param(
  [ValidateSet("customer", "provider")]
  [string]$App,
  [string]$AvdName = "Pixel_6_API_33",
  [string]$RepoRoot = "C:\dev\massage-on-demand-vn",
  [int]$ApiPort = 3000
)

$ErrorActionPreference = "Stop"

$adbPath = "C:\Users\laboy\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$emulatorPath = "C:\Users\laboy\AppData\Local\Android\Sdk\emulator\emulator.exe"

function Test-HttpOk {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

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

function Get-RunningEmulatorSerial {
  $deviceLines = (& $adbPath devices) | Select-Object -Skip 1
  foreach ($line in $deviceLines) {
    if (-not $line.Trim()) {
      continue
    }

    $parts = $line -split "\s+"
    if ($parts.Length -ge 2 -and $parts[0] -like "emulator-*" -and $parts[1] -eq "device") {
      return $parts[0]
    }
  }

  return $null
}

function Wait-ForEmulatorBoot {
  param([string]$Serial)

  $deadline = (Get-Date).AddMinutes(5)
  do {
    $bootCompleted = (& $adbPath -s $Serial shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootCompleted -eq "1") {
      return
    }

    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)

  throw "Emulator $Serial did not finish booting within 5 minutes."
}

if (-not (Test-Path $RepoRoot)) {
  throw "Repo root not found: $RepoRoot"
}

if (-not (Test-Path $adbPath)) {
  throw "adb not found at $adbPath"
}

if (-not (Test-Path $emulatorPath)) {
  throw "emulator not found at $emulatorPath"
}

if (-not (Test-HttpOk -Url "http://localhost:$ApiPort/api/health")) {
  throw "HANDS API is not responding on http://localhost:$ApiPort/api/health. Start local services first with start-hands-local.ps1."
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

$serial = Get-RunningEmulatorSerial
if (-not $serial) {
  Write-Host "Starting emulator: $AvdName"
  Start-Process -FilePath $emulatorPath -ArgumentList @("-avd", $AvdName) -WindowStyle Normal | Out-Null

  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep -Seconds 5
    $serial = Get-RunningEmulatorSerial
  } while (-not $serial -and (Get-Date) -lt $deadline)

  if (-not $serial) {
    throw "Emulator $AvdName did not appear in adb devices within 2 minutes."
  }
}

Write-Host "Using emulator device: $serial"
Wait-ForEmulatorBoot -Serial $serial

Push-Location $appDir
try {
  $flutterArgs = @(
    "run",
    "-d",
    $serial,
    "--dart-define=API_BASE_URL=http://10.0.2.2:$ApiPort/api",
    "--dart-define=SOCKET_BASE_URL=http://10.0.2.2:$ApiPort"
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
