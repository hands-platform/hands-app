param(
  [switch]$WithServices,
  [switch]$SkipBuild,
  [switch]$UseExistingApi
)

$ErrorActionPreference = "Continue"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$results = @()
$knownToolPaths = @(
  "C:\Program Files\Git\cmd",
  "C:\Program Files\Docker\Docker\resources\bin",
  "C:\tools\flutter\bin"
)

foreach ($toolPath in $knownToolPaths) {
  if ((Test-Path $toolPath) -and -not ($env:Path.Split(";") -contains $toolPath)) {
    $env:Path = "$toolPath;$env:Path"
  }
}
$localGitConfig = Join-Path $root "logs\gitconfig-codex"
New-Item -ItemType Directory -Force (Split-Path $localGitConfig) | Out-Null
@"
[safe]
	directory = C:/tools/flutter
	directory = $($root.Path.Replace("\", "/"))
"@ | Set-Content -LiteralPath $localGitConfig -NoNewline
$env:GIT_CONFIG_GLOBAL = $localGitConfig

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail
  )

  $script:results += [pscustomobject]@{
    Check = $Name
    Status = $Status
    Detail = $Detail
  }
}

function Test-CommandExists {
  param([string]$Command)
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Test-DirectoryWritable {
  param([string]$Directory)

  try {
    if (-not (Test-Path $Directory)) {
      return $false
    }
    $probe = Join-Path $Directory ".codex-write-test"
    Set-Content -LiteralPath $probe -Value "ok" -NoNewline -ErrorAction Stop
    Remove-Item -LiteralPath $probe -Force -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(1500, $false)) {
      return $false
    }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-FreeTcpPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return $listener.LocalEndpoint.Port
  } finally {
    $listener.Stop()
  }
}

function Test-LocalInfraReady {
  $postgresReady = Test-TcpPort -HostName "127.0.0.1" -Port 5432
  $redisReady = Test-TcpPort -HostName "127.0.0.1" -Port 6379
  $minioReady = $false

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:9000/minio/health/live" -UseBasicParsing -TimeoutSec 2
    $minioReady = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    $minioReady = $false
  }

  return $postgresReady -and $redisReady -and $minioReady
}

function Repair-LocalInfraPorts {
  Write-Host "Running: docker compose host port repair"
  try {
    $downOutput = (& docker compose down 2>&1 | Out-String).Trim()
    $upOutput = (& docker compose up -d 2>&1 | Out-String).Trim()

    if ($LASTEXITCODE -ne 0) {
      Add-Result "docker compose host ports" "FAIL" "Docker compose repair failed while recreating local infra.`n$downOutput`n$upOutput"
      return $false
    }

    for ($i = 0; $i -lt 20; $i++) {
      if (Test-LocalInfraReady) {
        Add-Result "docker compose host ports" "PASS" "Recreated local infra because Docker Desktop started containers without reachable localhost ports."
        return $true
      }
      Start-Sleep -Seconds 1
    }

    Add-Result "docker compose host ports" "FAIL" "Local infra containers were recreated, but Postgres, Redis, or MinIO still did not bind to localhost."
    return $false
  } catch {
    Add-Result "docker compose host ports" "FAIL" $_.Exception.Message
    return $false
  } finally {
    $global:LASTEXITCODE = 0
  }
}

function Invoke-Check {
  param(
    [string]$Name,
    [string]$Command,
    [string]$WorkingDirectory = $root
  )

  Push-Location $WorkingDirectory
  try {
    Write-Host "Running: $Name"
    Invoke-Expression $Command
    if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
      Add-Result $Name "PASS" $Command
    } else {
      Add-Result $Name "FAIL" "Exit code $LASTEXITCODE - $Command"
    }
  } catch {
    Add-Result $Name "FAIL" $_.Exception.Message
  } finally {
    Pop-Location
    $global:LASTEXITCODE = 0
  }
}

function Invoke-SmokeWithApi {
  param(
    [string]$ApiBaseUrl = "http://localhost:3000/api",
    [string]$SocketBaseUrl = "http://localhost:3000",
    [switch]$IncludeSupabaseAuthSmoke
  )

  Invoke-Check "api readiness against local services" "Invoke-RestMethod $ApiBaseUrl/health/ready | ConvertTo-Json -Depth 5"
  Invoke-Check "api smoke against local services" "`$env:API_BASE_URL='$ApiBaseUrl'; `$env:SOCKET_BASE_URL='$SocketBaseUrl'; node infra\scripts\api-smoke.mjs"
  Invoke-Check "realtime smoke against local services" "`$env:API_BASE_URL='$ApiBaseUrl'; `$env:SOCKET_BASE_URL='$SocketBaseUrl'; node infra\scripts\realtime-smoke.mjs"
  if ($IncludeSupabaseAuthSmoke) {
    Invoke-Check "supabase auth smoke against local services" "`$env:API_BASE_URL='$ApiBaseUrl'; `$env:SUPABASE_JWT_SECRET='dev-supabase-jwt-secret-for-local-smoke'; node infra\scripts\supabase-auth-smoke.mjs"
  }
}

function Invoke-SmokeWithManagedApi {
  $managedApiPort = Get-FreeTcpPort
  $managedApiBaseUrl = "http://localhost:$managedApiPort/api"
  $managedSocketBaseUrl = "http://localhost:$managedApiPort"
  $managedHealthUrl = "$managedApiBaseUrl/health"

  $job = Start-Job -ScriptBlock {
    Set-Location $using:root
    $env:DATABASE_URL = "postgresql://massage:massage@localhost:5432/massage_vn?schema=public"
    $env:REDIS_URL = "redis://localhost:6379"
    $env:NODE_ENV = "development"
    $env:API_PORT = "$using:managedApiPort"
    $env:JWT_ACCESS_SECRET = "dev-access-secret"
    $env:JWT_REFRESH_SECRET = "dev-refresh-secret"
    $env:SUPABASE_JWT_SECRET = "dev-supabase-jwt-secret-for-local-smoke"
    $env:SUPABASE_JWT_AUDIENCE = "authenticated"
    $env:DEV_OTP = "123456"
    $env:S3_ENDPOINT = "http://localhost:9000"
    $env:S3_REGION = "auto"
    $env:S3_BUCKET = "massage-vn"
    $env:S3_ACCESS_KEY = "minioadmin"
    $env:S3_SECRET_KEY = "minioadmin"
    $env:S3_PUBLIC_BASE_URL = "http://localhost:9000/massage-vn"
    node apps/api/dist/main.js
  }

  try {
    $ready = $false
    for ($i = 0; $i -lt 120; $i++) {
      Start-Sleep -Seconds 1
      try {
        Invoke-RestMethod $managedHealthUrl | Out-Null
        $ready = $true
        break
      } catch {}
    }

    if (-not $ready) {
      Receive-Job $job -Keep
      Add-Result "api smoke against local services" "FAIL" "Managed API did not become healthy on port $managedApiPort within 120 seconds."
      return
    }

    Add-Result "api runtime source" "PASS" "Started managed HANDS API on $managedApiBaseUrl"
    Invoke-SmokeWithApi -ApiBaseUrl $managedApiBaseUrl -SocketBaseUrl $managedSocketBaseUrl -IncludeSupabaseAuthSmoke
  } finally {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
  }
}

Push-Location $root

Write-Host "== Development Environment =="
try {
  powershell -ExecutionPolicy Bypass -File .\infra\scripts\check-dev-env.ps1
  if ($LASTEXITCODE -eq 0) {
    Add-Result "dev environment" "PASS" "All required tools are available."
  } else {
    Add-Result "dev environment" "WARN" "Some required tools are missing. See table above."
  }
} catch {
  Add-Result "dev environment" "FAIL" $_.Exception.Message
}
$global:LASTEXITCODE = 0

Invoke-Check "script syntax: api smoke" "node --check infra\scripts\api-smoke.mjs"
Invoke-Check "script syntax: admin web smoke" "node --check infra\scripts\admin-web-smoke.mjs"
Invoke-Check "script syntax: realtime smoke" "node --check infra\scripts\realtime-smoke.mjs"
Invoke-Check "script syntax: supabase auth smoke" "node --check infra\scripts\supabase-auth-smoke.mjs"
Invoke-Check "script syntax: env check" "node --check infra\scripts\check-env.mjs"
Invoke-Check "script syntax: external setup check" "node --check infra\scripts\check-external-setup.mjs"
Invoke-Check "script syntax: external registration pack" "node --check infra\scripts\external-registration-pack.mjs"
Invoke-Check "script syntax: setup doctor" "node --check infra\scripts\setup-doctor.mjs"
Invoke-Check "script syntax: secret leak check" "node --check infra\scripts\check-secret-leaks.mjs"
Invoke-Check "script syntax: admin sensitive exposure" "node --check infra\scripts\check-admin-sensitive-exposure.mjs"
Invoke-Check "script syntax: admin visible copy" "node --check infra\scripts\check-admin-visible-copy.mjs"
Invoke-Check "script syntax: admin shared format" "node --check infra\scripts\check-admin-shared-format.mjs"
Invoke-Check "script syntax: shared types source guard" "node --check infra\scripts\check-shared-types-runtime-imports.mjs"
Invoke-Check "script syntax: notification partner alert contract" "node --check infra\scripts\check-notification-partner-alert-contract.mjs"
Invoke-Check "script syntax: notification retry audit contract" "node --check infra\scripts\check-notification-retry-audit-contract.mjs"
Invoke-Check "script syntax: fcm env contract" "node --check infra\scripts\check-fcm-env-contract.mjs"
Invoke-Check "script syntax: fcm credentials check" "node --check infra\scripts\check-firebase-admin-credentials.mjs"
Invoke-Check "script syntax: fcm credentials install" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\install-firebase-admin-credentials.ps1')))`""
Invoke-Check "script syntax: final authority check" "node --check infra\scripts\check-final-authority.mjs"
Invoke-Check "script syntax: api policy coverage" "node --check infra\scripts\check-api-policy-coverage.mjs"
Invoke-Check "script syntax: vietnam scope" "node --check infra\scripts\check-vietnam-scope.mjs"
Invoke-Check "script syntax: api domain smoke" "node --check infra\scripts\api-domain-smoke.mjs"
Invoke-Check "script syntax: mobile firebase removal check" "node --check infra\scripts\check-mobile-firebase.mjs"
Invoke-Check "script syntax: flutter architecture check" "node --check infra\scripts\check-flutter-architecture.mjs"
Invoke-Check "script syntax: supabase schema check" "node --check infra\scripts\check-supabase-schema.mjs"
Invoke-Check "script syntax: supabase sql pack" "node --check infra\scripts\prepare-supabase-sql-pack.mjs"
Invoke-Check "script syntax: seed" "node --check apps\api\prisma\seed.js"
Invoke-Check "script syntax: android signing helper" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\create-android-upload-keystores.ps1')))`""
Invoke-Check "script syntax: local start" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\start-hands-local.ps1')))`""
Invoke-Check "script syntax: local stop" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\stop-hands-local.ps1')))`""
Invoke-Check "script syntax: local status" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\status-hands-local.ps1')))`""
Invoke-Check "env example" "node infra\scripts\check-env.mjs .env.example"
Invoke-Check "external setup advisory" "node infra\scripts\check-external-setup.mjs"
Invoke-Check "external registration pack" "node infra\scripts\external-registration-pack.mjs --format=json"
Invoke-Check "external registration pack file" "npm.cmd run external:pack:write"
Invoke-Check "setup doctor" "npm.cmd run setup:doctor"
Invoke-Check "secret leak check" "npm.cmd run security:secrets"
Invoke-Check "admin sensitive exposure" "npm.cmd run security:admin-sensitive"
Invoke-Check "admin visible copy" "npm.cmd run admin:visible-copy"
Invoke-Check "admin shared format" "npm.cmd run admin:shared-format"
Invoke-Check "notification partner alert contract" "npm.cmd run notifications:partner-alert-contract"
Invoke-Check "notification retry audit contract" "npm.cmd run notifications:retry-audit-contract"
Invoke-Check "fcm env contract" "npm.cmd run fcm:env-contract"
Invoke-Check "realtime event contract" "npm.cmd run realtime:contract"
Invoke-Check "final authority check" "npm.cmd run authority:check"
Invoke-Check "api policy coverage" "npm.cmd run api:policy-coverage"
Invoke-Check "vietnam scope check" "npm.cmd run scope:vietnam"
Invoke-Check "api domain smoke" "npm.cmd run api:domain-smoke"
Invoke-Check "mobile firebase removed" "node infra\scripts\check-mobile-firebase.mjs"
Invoke-Check "flutter clean architecture guard" "node infra\scripts\check-flutter-architecture.mjs"
Invoke-Check "supabase schema alignment" "node infra\scripts\check-supabase-schema.mjs"
Invoke-Check "supabase sql pack" "node infra\scripts\prepare-supabase-sql-pack.mjs"
Invoke-Check "prisma validate" "`$env:DATABASE_URL='postgresql://massage:massage@localhost:5432/massage_vn?schema=public'; npx.cmd prisma validate --schema apps/api/prisma/schema.prisma"
Invoke-Check "api typecheck" "npm.cmd run typecheck --workspace @massage-vn/api"
Invoke-Check "admin test" "npm.cmd run test --workspace @massage-vn/admin-web"
Invoke-Check "admin typecheck" "npm.cmd run typecheck --workspace @massage-vn/admin-web"

if (-not $SkipBuild) {
  Invoke-Check "api build" "npm.cmd run build --workspace @massage-vn/api"
  Invoke-Check "admin build" "npm.cmd run build --workspace @massage-vn/admin-web"
} else {
  Add-Result "api build" "SKIP" "SkipBuild was set."
  Add-Result "admin build" "SKIP" "SkipBuild was set."
}

if (Test-CommandExists "git") {
  if (-not (Test-Path (Join-Path $root ".git"))) {
    Add-Result "git status" "SKIP" "Git is installed, but this folder is not initialized as a Git repository."
  } else {
    $safeGitRoot = $root.Path.Replace("\", "/")
    Invoke-Check "git status" "git -c safe.directory=`"$safeGitRoot`" status --short"
  }
} else {
  Add-Result "git status" "SKIP" "Git is not installed or not on PATH."
}

if (Test-CommandExists "docker") {
  Invoke-Check "docker compose config" "docker compose config --quiet"
  docker info --format "{{.ServerVersion}}" *> $null
  $dockerReady = $LASTEXITCODE -eq 0
  $global:LASTEXITCODE = 0

  if ($WithServices -and $dockerReady) {
    Write-Host "Running: docker compose up"
    $composeOutput = ""
    try {
      $composeOutput = (& docker compose up -d 2>&1 | Out-String).Trim()
      if ($LASTEXITCODE -eq 0) {
        Add-Result "docker compose up" "PASS" "docker compose up -d"
      } elseif ($composeOutput -match "port is already allocated" -and (Test-LocalInfraReady)) {
        Add-Result "docker compose up" "PASS" "docker compose up -d (reused existing local infra because compose ports were already allocated)"
      } else {
        Add-Result "docker compose up" "FAIL" "Exit code $LASTEXITCODE - docker compose up -d`n$composeOutput"
      }
    } catch {
      if (Test-LocalInfraReady) {
        Add-Result "docker compose up" "PASS" "docker compose up -d (reused existing local infra after compose startup warning)"
      } else {
        Add-Result "docker compose up" "FAIL" $_.Exception.Message
      }
    } finally {
      $global:LASTEXITCODE = 0
    }

    if (Test-LocalInfraReady) {
      Add-Result "docker compose host ports" "PASS" "Postgres, Redis, and MinIO are reachable on localhost."
    } elseif (-not (Repair-LocalInfraPorts)) {
      Add-Result "prisma migrate deploy" "FAIL" "Local infra host ports are not reachable, so database migration cannot run."
      Add-Result "prisma seed" "FAIL" "Local infra host ports are not reachable, so seed cannot run."
      Add-Result "api smoke against local services" "FAIL" "Local infra host ports are not reachable, so API smoke tests cannot run."
      Write-Host ""
      Write-Host "== Local Verification Summary =="
      $results | Format-Table -AutoSize
      Pop-Location
      exit 1
    }

    Invoke-Check "prisma migrate deploy" "`$env:DATABASE_URL='postgresql://massage:massage@localhost:5432/massage_vn?schema=public'; npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma"
    Invoke-Check "prisma seed" "`$env:DATABASE_URL='postgresql://massage:massage@localhost:5432/massage_vn?schema=public'; npm.cmd run prisma:seed --workspace @massage-vn/api"

    $existingHandsApiReady = $false
    if ($UseExistingApi) {
      try {
        Invoke-RestMethod "http://localhost:3000/api/health/ready" | Out-Null
        $existingHandsApiReady = $true
      } catch {}
    }

    if ($UseExistingApi -and $existingHandsApiReady) {
      Add-Result "api runtime source" "PASS" "Using existing HANDS local API on http://localhost:3000/api"
      Invoke-SmokeWithApi -ApiBaseUrl "http://localhost:3000/api" -SocketBaseUrl "http://localhost:3000"
    } else {
      Invoke-SmokeWithManagedApi
    }
  } elseif ($WithServices) {
    Add-Result "docker compose up" "SKIP" "Docker CLI is installed, but Docker Desktop daemon is not ready or access is denied."
    Add-Result "api smoke against local services" "SKIP" "Needs a ready Docker daemon and local API services."
  } else {
    Add-Result "docker compose up" "SKIP" "Run with -WithServices after Docker Desktop is installed and running."
    Add-Result "api smoke against local services" "SKIP" "Needs Docker services or an already running API."
  }
} else {
  Add-Result "docker compose config" "SKIP" "Docker is not installed or not on PATH."
  Add-Result "docker compose up" "SKIP" "Docker is not installed or not on PATH."
  Add-Result "api smoke against local services" "SKIP" "Docker/API services are not available."
}

$flutterCache = "C:\tools\flutter\bin\cache"
if ((Test-CommandExists "flutter") -and (Test-DirectoryWritable $flutterCache)) {
  Invoke-Check "customer flutter pub get" "flutter pub get" "$root\apps\customer_app"
  Invoke-Check "customer flutter analyze" "flutter analyze" "$root\apps\customer_app"
  Invoke-Check "customer flutter test" "flutter test" "$root\apps\customer_app"
  Invoke-Check "provider flutter pub get" "flutter pub get" "$root\apps\provider_app"
  Invoke-Check "provider flutter analyze" "flutter analyze" "$root\apps\provider_app"
  Invoke-Check "provider flutter test" "flutter test" "$root\apps\provider_app"
} elseif (Test-CommandExists "flutter") {
  Add-Result "customer flutter pub get" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
  Add-Result "customer flutter analyze" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
  Add-Result "customer flutter test" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
  Add-Result "provider flutter pub get" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
  Add-Result "provider flutter analyze" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
  Add-Result "provider flutter test" "SKIP" "Flutter is installed, but $flutterCache is not writable by this user."
} else {
  Add-Result "customer flutter pub get" "SKIP" "Flutter is not installed or not on PATH."
  Add-Result "customer flutter analyze" "SKIP" "Flutter is not installed or not on PATH."
  Add-Result "customer flutter test" "SKIP" "Flutter is not installed or not on PATH."
  Add-Result "provider flutter pub get" "SKIP" "Flutter is not installed or not on PATH."
  Add-Result "provider flutter analyze" "SKIP" "Flutter is not installed or not on PATH."
  Add-Result "provider flutter test" "SKIP" "Flutter is not installed or not on PATH."
}

Write-Host ""
Write-Host "== Local Verification Summary =="
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq "FAIL" })
Pop-Location

if ($failed.Count -gt 0) {
  exit 1
}

exit 0
