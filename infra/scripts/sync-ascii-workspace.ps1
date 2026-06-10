param(
  [string]$Target = "C:\dev\massage-on-demand-vn"
)

$ErrorActionPreference = "Stop"
$source = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$targetFullPath = [System.IO.Path]::GetFullPath($Target)
$sourceFullPath = [System.IO.Path]::GetFullPath($source.Path)

if ($sourceFullPath.TrimEnd('\') -ieq $targetFullPath.TrimEnd('\')) {
  Write-Host "Workspace is already in the standard HANDS path: $targetFullPath"
  exit 0
}

if (-not (Test-Path "C:\dev")) {
  New-Item -ItemType Directory -Path "C:\dev" -Force | Out-Null
}

New-Item -ItemType Directory -Path $Target -Force | Out-Null

$excludeDirs = @(
  "node_modules",
  "build",
  ".dart_tool",
  ".next",
  "dist",
  "coverage",
  "logs"
)

$arguments = @(
  $source.Path,
  $Target,
  "/E",
  "/R:2",
  "/W:1",
  "/XD"
) + $excludeDirs

Write-Host "Syncing workspace to $Target"
robocopy @arguments | Out-Host
$code = $LASTEXITCODE

if ($code -ge 8) {
  throw "robocopy failed with exit code $code"
}

Write-Host "Workspace synced to $Target"
