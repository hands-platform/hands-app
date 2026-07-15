param(
  [ValidateSet("preflight", "api", "admin", "customer", "provider", "mobile", "node", "docs", "harness", "full")]
  [string]$Scope = "preflight",
  [switch]$SkipBuild,
  [switch]$WithServices
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

function Invoke-Preflight {
  if (Test-CommandExists "git") {
    Invoke-Check "git root" "git rev-parse --show-toplevel"
    Invoke-Check "git branch" "git branch --show-current"
    Invoke-Check "git status" "git status --short"
    $changed = (& git status --short 2>$null) -join "`n"
    $protectedPatterns = @(
      "apps/api/prisma/",
      "apps/api/src/auth/",
      "apps/api/src/payments/",
      "apps/api/src/provider-wallet/",
      "apps/api/src/matching/",
      "apps/api/src/bookings/",
      "packages/shared-types/",
      "infra/supabase/",
      ".github/workflows/",
      "docker-compose",
      ".env"
    )
    $protectedHits = @()
    foreach ($pattern in $protectedPatterns) {
      if ($changed -replace "\\", "/" -match [regex]::Escape($pattern)) {
        $protectedHits += $pattern
      }
    }
    if ($protectedHits.Count -gt 0) {
      Add-Result "protected changed files" "WARN" ("Review required for: " + ($protectedHits -join ", "))
    } else {
      Add-Result "protected changed files" "PASS" "No protected area changes detected in git status."
    }
  } else {
    Add-Result "git" "FAIL" "Git is not installed or not on PATH."
  }

  foreach ($required in @("package.json", "package-lock.json", "apps/api/package.json", "apps/admin_web/package.json", "apps/customer_app/pubspec.yaml", "apps/provider_app/pubspec.yaml")) {
    if (Test-Path (Join-Path $root $required)) {
      Add-Result "required file: $required" "PASS" "Found."
    } else {
      Add-Result "required file: $required" "FAIL" "Missing."
    }
  }

  foreach ($command in @("node", "npm.cmd", "npx.cmd", "flutter")) {
    if (Test-CommandExists $command) {
      Invoke-Check "tool: $command" "$command --version"
    } else {
      Add-Result "tool: $command" "WARN" "$command is not installed or not on PATH."
    }
  }
}

function Invoke-Api {
  Invoke-Check "prisma validate" "`$env:DATABASE_URL='postgresql://massage:massage@localhost:5432/massage_vn?schema=public'; npx.cmd prisma validate --schema apps/api/prisma/schema.prisma"
  Invoke-Check "api policy coverage" "npm.cmd run api:policy-coverage"
  Invoke-Check "fcm env contract" "npm.cmd run fcm:env-contract"
  Invoke-Check "notification partner alert contract" "npm.cmd run notifications:partner-alert-contract"
  Invoke-Check "notification retry audit contract" "npm.cmd run notifications:retry-audit-contract"
  Invoke-Check "realtime event contract" "npm.cmd run realtime:contract"
  Invoke-Check "api test" "npm.cmd run api:test"
  Invoke-Check "api typecheck" "npm.cmd run typecheck --workspace @massage-vn/api"
  Invoke-Check "api lint" "npm.cmd run lint --workspace @massage-vn/api"
  if ($SkipBuild) {
    Add-Result "api build" "SKIP" "SkipBuild was set."
  } else {
    Invoke-Check "api build" "npm.cmd run build --workspace @massage-vn/api"
  }
}

function Invoke-Admin {
  Invoke-Check "fcm env contract" "npm.cmd run fcm:env-contract"
  Invoke-Check "notification partner alert contract" "npm.cmd run notifications:partner-alert-contract"
  Invoke-Check "notification retry audit contract" "npm.cmd run notifications:retry-audit-contract"
  Invoke-Check "admin test" "npm.cmd run test --workspace @massage-vn/admin-web"
  Invoke-Check "admin typecheck" "npm.cmd run typecheck --workspace @massage-vn/admin-web"
  Invoke-Check "admin lint" "npm.cmd run lint --workspace @massage-vn/admin-web"
  Invoke-Check "admin query guards" "npm.cmd run admin:query-guards"
  Invoke-Check "admin visible copy" "npm.cmd run admin:visible-copy"
  if ($SkipBuild) {
    Add-Result "admin build" "SKIP" "SkipBuild was set."
  } else {
    Invoke-Check "admin build" "npm.cmd run build --workspace @massage-vn/admin-web"
  }
}

function Invoke-Customer {
  Invoke-Check "customer flutter analyze" "flutter analyze" "$root\apps\customer_app"
  Invoke-Check "customer flutter test" "flutter test" "$root\apps\customer_app"
}

function Invoke-Provider {
  Invoke-Check "provider flutter analyze" "flutter analyze" "$root\apps\provider_app"
  Invoke-Check "provider flutter test" "flutter test" "$root\apps\provider_app"
}

function Invoke-Harness {
  Invoke-Check "script syntax: verify local" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\verify-local.ps1')))`""
  Invoke-Check "script syntax: verify scope" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\verify-scope.ps1')))`""
  Invoke-Check "script syntax: api smoke" "node --check infra\scripts\api-smoke.mjs"
  Invoke-Check "script syntax: admin web smoke" "node --check infra\scripts\admin-web-smoke.mjs"
  Invoke-Check "script syntax: realtime smoke" "node --check infra\scripts\realtime-smoke.mjs"
  Invoke-Check "script syntax: final authority" "node --check infra\scripts\check-final-authority.mjs"
  Invoke-Check "script syntax: admin sensitive exposure" "node --check infra\scripts\check-admin-sensitive-exposure.mjs"
  Invoke-Check "script syntax: admin visible copy" "node --check infra\scripts\check-admin-visible-copy.mjs"
  Invoke-Check "script syntax: shared types source guard" "node --check infra\scripts\check-shared-types-runtime-imports.mjs"
  Invoke-Check "script syntax: notification partner alert contract" "node --check infra\scripts\check-notification-partner-alert-contract.mjs"
  Invoke-Check "script syntax: notification retry audit contract" "node --check infra\scripts\check-notification-retry-audit-contract.mjs"
  Invoke-Check "script syntax: fcm env contract" "node --check infra\scripts\check-fcm-env-contract.mjs"
  Invoke-Check "script syntax: fcm credentials check" "node --check infra\scripts\check-firebase-admin-credentials.mjs"
  Invoke-Check "script syntax: fcm credentials install" "powershell -NoProfile -Command `"[void][scriptblock]::Create([System.IO.File]::ReadAllText((Resolve-Path '.\infra\scripts\install-firebase-admin-credentials.ps1')))`""
  Invoke-Check "script syntax: vietnam scope" "node --check infra\scripts\check-vietnam-scope.mjs"
}

function Invoke-Docs {
  Invoke-Check "final authority check" "npm.cmd run authority:check"
  Invoke-Check "vietnam scope check" "npm.cmd run scope:vietnam"
  Invoke-Check "mobile visible copy check" "npm.cmd run mobile:visible-copy"
  Invoke-Check "admin visible copy check" "npm.cmd run admin:visible-copy"
  Add-Result "markdown lint" "SKIP" "No markdown lint tool is configured in this repo."
}

Push-Location $root
try {
  Write-Host "== HANDS Scope Verification =="
  Write-Host "Root: $($root.Path)"
  Write-Host "Scope: $Scope"

  switch ($Scope) {
    "preflight" { Invoke-Preflight }
    "api" { Invoke-Preflight; Invoke-Api }
    "admin" { Invoke-Preflight; Invoke-Admin }
    "customer" { Invoke-Preflight; Invoke-Customer }
    "provider" { Invoke-Preflight; Invoke-Provider }
    "mobile" { Invoke-Preflight; Invoke-Customer; Invoke-Provider }
    "node" { Invoke-Preflight; Invoke-Api; Invoke-Admin; Invoke-Check "shared types typecheck" "npm.cmd run typecheck --workspace @massage-vn/shared-types" }
    "docs" { Invoke-Preflight; Invoke-Docs }
    "harness" { Invoke-Preflight; Invoke-Harness }
    "full" {
      $command = "powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1"
      if ($WithServices) {
        $command += " -WithServices"
      }
      if ($SkipBuild) {
        $command += " -SkipBuild"
      }
      Invoke-Check "full local verify" $command
    }
  }

  Write-Host ""
  Write-Host "== Scope Verification Summary =="
  $results | Format-Table -AutoSize

  $failed = @($results | Where-Object { $_.Status -eq "FAIL" })
  if ($failed.Count -gt 0) {
    exit 1
  }
  exit 0
} finally {
  Pop-Location
}
