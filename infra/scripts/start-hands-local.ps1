param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [int]$ApiPort = 3000,
  [int]$AdminPort = 3101,
  [switch]$SkipAdmin,
  [switch]$AdminProduction,
  [switch]$AdminDevelopment
)

$ErrorActionPreference = "Stop"

if ($AdminProduction -and $AdminDevelopment) {
  throw "Choose either -AdminProduction or -AdminDevelopment, not both."
}
$useAdminProduction = -not $AdminDevelopment

function Assert-PortFree {
  param([int]$Port)

  $inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($inUse) {
    throw "Port $Port is already in use. Stop the existing process or choose a different port."
  }
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds,
    [int[]]$AllowedStatusCodes = @(200)
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
      if ($AllowedStatusCodes -contains [int]$response.StatusCode) {
        return
      }
    } catch {
      $exception = $_.Exception
      if ($exception.Response -and $AllowedStatusCodes -contains [int]$exception.Response.StatusCode.value__) {
        return
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url"
}

function Ensure-WorkspaceReady {
  param([string]$Root)

  $nextBinary = Join-Path $Root "node_modules\next\dist\bin\next"
  $globModule = Join-Path $Root "node_modules\glob\dist\commonjs\glob.js"

  if (-not (Test-Path $nextBinary) -or -not (Test-Path $globModule)) {
    Write-Host "Installing npm dependencies in $Root"
    & npm.cmd ci --prefix $Root
    if ($LASTEXITCODE -ne 0) {
      throw "npm ci failed for $Root"
    }
  }

  Write-Host "Generating Prisma client in $Root"
  Push-Location $Root
  try {
    & .\node_modules\.bin\prisma.cmd generate --schema .\apps\api\prisma\schema.prisma
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma generate failed for $Root"
    }
  } finally {
    Pop-Location
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

function Set-DefaultEnvIfMissing {
  param(
    [string]$Key,
    [string]$Value
  )

  if (-not [Environment]::GetEnvironmentVariable($Key, "Process")) {
    [Environment]::SetEnvironmentVariable($Key, $Value, "Process")
  }
}

function Set-LocalServiceDefaults {
  Set-DefaultEnvIfMissing -Key "DATABASE_URL" -Value "postgresql://massage:massage@localhost:5432/massage_vn?schema=public"
  Set-DefaultEnvIfMissing -Key "REDIS_URL" -Value "redis://localhost:6379"
  Set-DefaultEnvIfMissing -Key "SUPABASE_JWT_SECRET" -Value "dev-supabase-jwt-secret-for-local-smoke"
  Set-DefaultEnvIfMissing -Key "SUPABASE_JWT_AUDIENCE" -Value "authenticated"
  if ([Environment]::GetEnvironmentVariable("NODE_ENV", "Process") -ne "production") {
    Set-DefaultEnvIfMissing -Key "MOBILE_AUTH_ALLOW_DEV_OTP" -Value "true"
    Set-DefaultEnvIfMissing -Key "DEV_OTP" -Value "123456"
  }
  Set-DefaultEnvIfMissing -Key "STORAGE_PROVIDER" -Value "s3-compatible"
  Set-DefaultEnvIfMissing -Key "S3_ENDPOINT" -Value "http://localhost:9000"
  Set-DefaultEnvIfMissing -Key "S3_REGION" -Value "auto"
  Set-DefaultEnvIfMissing -Key "S3_BUCKET" -Value "massage-vn"
  Set-DefaultEnvIfMissing -Key "S3_ACCESS_KEY" -Value "minioadmin"
  Set-DefaultEnvIfMissing -Key "S3_SECRET_KEY" -Value "minioadmin"
  Set-DefaultEnvIfMissing -Key "S3_PUBLIC_BASE_URL" -Value "http://localhost:9000/massage-vn"

  # The broad local smoke exercises placeholder CARD/MOMO/VNPAY booking states. The API
  # ignores this override in production, and an explicit local false value remains authoritative.
  if ([Environment]::GetEnvironmentVariable("NODE_ENV", "Process") -ne "production") {
    Set-DefaultEnvIfMissing -Key "ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS" -Value "true"
  }
}

function Clear-ApiDist {
  param([string]$Root)

  $apiDist = Join-Path $Root "apps\api\dist"
  if (Test-Path $apiDist) {
    Write-Host "Clearing stale API build output in $apiDist"
    Remove-Item -LiteralPath $apiDist -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$logDir = Join-Path $RepoRoot "logs\hands-local"
$statePath = Join-Path $logDir "state.json"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Assert-PortFree -Port $ApiPort
if (-not $SkipAdmin) {
  Assert-PortFree -Port $AdminPort
}
Import-DotEnvIfPresent -Root $RepoRoot
Set-LocalServiceDefaults
Ensure-WorkspaceReady -Root $RepoRoot
Clear-ApiDist -Root $RepoRoot

$apiLog = Join-Path $logDir "api.log"
$adminLog = Join-Path $logDir "admin.log"
$adminProductionDistDir = ".next-hands-local-prod"

$apiCommand = @"
Set-Location '$RepoRoot'
`$env:API_PORT='$ApiPort'
`$env:ADMIN_API_BASE_URL='http://localhost:$ApiPort/api'
npm.cmd run build --workspace @massage-vn/api *> '$apiLog'
if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
npm.cmd run start --workspace @massage-vn/api *> '$apiLog'
"@

$adminCommand = if ($useAdminProduction) {
@"
Set-Location '$RepoRoot'
`$env:NODE_ENV='production'
`$env:ADMIN_API_BASE_URL='http://localhost:$ApiPort/api'
`$env:ADMIN_NEXT_DIST_DIR='$adminProductionDistDir'
`$nextEnvPath = Join-Path '$RepoRoot' 'apps\admin_web\next-env.d.ts'
`$nextEnvBeforeBuild = [System.IO.File]::ReadAllText(`$nextEnvPath)
try {
  npm.cmd run build --workspace @massage-vn/admin-web *> '$adminLog'
  `$adminBuildExitCode = `$LASTEXITCODE
} finally {
  [System.IO.File]::WriteAllText(`$nextEnvPath, `$nextEnvBeforeBuild)
}
if (`$adminBuildExitCode -ne 0) { exit `$adminBuildExitCode }
npm.cmd run start --workspace @massage-vn/admin-web -- --port $AdminPort *>> '$adminLog'
"@
} else {
@"
Set-Location '$RepoRoot'
`$env:ADMIN_API_BASE_URL='http://localhost:$ApiPort/api'
npm.cmd run dev --workspace @massage-vn/admin-web -- --port $AdminPort *> '$adminLog'
"@
}

$apiProcess = Start-Process powershell -ArgumentList @(
  "-NoLogo",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  $apiCommand
) -WindowStyle Hidden -PassThru

$apiHealthWaitedBeforeAdmin = $false
if ($useAdminProduction -and -not $SkipAdmin) {
  # Production Admin starts after API health is ready to avoid concurrent API and Next build contention.
  Wait-HttpReady -Url "http://localhost:$ApiPort/api/health" -TimeoutSeconds 90
  $apiHealthWaitedBeforeAdmin = $true
}

$adminProcess = $null
if (-not $SkipAdmin) {
  $adminProcess = Start-Process powershell -ArgumentList @(
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $adminCommand
  ) -WindowStyle Hidden -PassThru
}

$state = [pscustomobject]@{
  appName = "HANDS"
  coverage = "Vietnam nationwide"
  repoRoot = $RepoRoot
  apiPort = $ApiPort
  adminPort = $AdminPort
  adminMode = if ($useAdminProduction) { "production" } else { "development" }
  adminDistDir = if ($useAdminProduction) { $adminProductionDistDir } else { ".next" }
  adminBuildId = $null
  apiPid = $apiProcess.Id
  adminPid = if ($adminProcess) { $adminProcess.Id } else { $null }
  startedAt = (Get-Date).ToString("o")
}
$state | ConvertTo-Json | Set-Content -Path $statePath -Encoding utf8

if (-not $apiHealthWaitedBeforeAdmin) {
  Wait-HttpReady -Url "http://localhost:$ApiPort/api/health" -TimeoutSeconds 90
}
if (-not $SkipAdmin) {
  Wait-HttpReady -Url "http://localhost:$AdminPort" -TimeoutSeconds 90 -AllowedStatusCodes @(200, 307, 308, 404)
  if ($useAdminProduction) {
    $adminBuildIdPath = Join-Path $RepoRoot "apps\admin_web\$adminProductionDistDir\BUILD_ID"
    if (-not (Test-Path -LiteralPath $adminBuildIdPath)) {
      throw "Production Admin BUILD_ID is missing at $adminBuildIdPath"
    }
    $state.adminBuildId = (Get-Content -Raw -LiteralPath $adminBuildIdPath).Trim()
    $state | ConvertTo-Json | Set-Content -Path $statePath -Encoding utf8
  }
}

Write-Host "HANDS local services started"
Write-Host "API:   http://localhost:$ApiPort/api/health"
if ($SkipAdmin) {
  Write-Host "Admin: skipped, existing admin can continue using http://localhost:$ApiPort/api"
} else {
  $adminModeLabel = if ($useAdminProduction) { "production" } else { "development" }
  Write-Host "Admin: http://localhost:$AdminPort ($adminModeLabel)"
}
Write-Host "Logs:  $logDir"
