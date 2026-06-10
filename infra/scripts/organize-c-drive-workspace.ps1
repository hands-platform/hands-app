param(
  [string]$Root = "C:\dev"
)

$ErrorActionPreference = "Stop"

$repoSource = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$workspaceBase = Split-Path $repoSource.Path -Parent
$repoTarget = Join-Path $Root "massage-on-demand-vn"
$secretsTarget = Join-Path $Root "hands-secrets"
$apkTarget = Join-Path $Root "hands-references\apk"
$analysisTarget = Join-Path $Root "hands-references\analysis"

$xapkSource = "C:\Users\laboy\Downloads\Glow+-+Massage+&+Spa+24_7_3.11.4_apkcombo.com.xapk"
$blackboxSource = Join-Path $workspaceBase "apk_blackbox_results_glow"

New-Item -ItemType Directory -Force -Path $secretsTarget | Out-Null
New-Item -ItemType Directory -Force -Path $apkTarget | Out-Null
New-Item -ItemType Directory -Force -Path $analysisTarget | Out-Null

$excludeDirs = @(
  "build",
  ".dart_tool",
  ".next",
  "dist",
  "coverage",
  "logs",
  "node_modules"
)

$repoSourceFull = [System.IO.Path]::GetFullPath($repoSource.Path).TrimEnd('\')
$repoTargetFull = [System.IO.Path]::GetFullPath($repoTarget).TrimEnd('\')
if ($repoSourceFull -ieq $repoTargetFull) {
  Write-Host "Repo already uses the standard path: $repoTarget"
} else {
  New-Item -ItemType Directory -Force -Path $repoTarget | Out-Null
  $repoArguments = @(
    $repoSource.Path,
    $repoTarget,
    "/E",
    "/R:2",
    "/W:1",
    "/XD"
  ) + $excludeDirs

  Write-Host "Syncing repo to $repoTarget"
  robocopy @repoArguments | Out-Host
  $repoCode = $LASTEXITCODE
  if ($repoCode -ge 8) {
    throw "robocopy repo sync failed with exit code $repoCode"
  }
}

if (Test-Path $xapkSource) {
  Copy-Item -LiteralPath $xapkSource -Destination (Join-Path $apkTarget (Split-Path $xapkSource -Leaf)) -Force
}

if (Test-Path $blackboxSource) {
  $analysisArguments = @(
    $blackboxSource,
    (Join-Path $analysisTarget "apk_blackbox_results_glow"),
    "/E",
    "/R:2",
    "/W:1"
  )
  Write-Host "Syncing analysis results to $analysisTarget"
  robocopy @analysisArguments | Out-Host
  $analysisCode = $LASTEXITCODE
  if ($analysisCode -ge 8) {
    throw "robocopy analysis sync failed with exit code $analysisCode"
  }
}

$summaryPath = Join-Path $Root "README_LOCAL.txt"
$summary = @"
HANDS local workspace

repo:
  $repoTarget

secrets:
  $secretsTarget

reference apk:
  $apkTarget

analysis:
  $analysisTarget
"@
Set-Content -Path $summaryPath -Value $summary -Encoding utf8

Write-Host "Workspace organized at $Root"
