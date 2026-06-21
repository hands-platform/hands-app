param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$DryRun,
  [switch]$Force,
  [switch]$IncludeNextBuild
)

$ErrorActionPreference = "Stop"

function Normalize-PathForCompare {
  param([string]$Path)

  return ([System.IO.Path]::GetFullPath($Path)).TrimEnd('\', '/')
}

function Resolve-TargetPath {
  param(
    [string]$Root,
    [string]$RelativePath
  )

  return Normalize-PathForCompare -Path (Join-Path $Root $RelativePath)
}

function Assert-PathInsideRepo {
  param(
    [string]$Root,
    [string]$Target
  )

  $repo = Normalize-PathForCompare -Path $Root
  $repoPrefix = "$repo\"
  if (-not ($Target.Equals($repo, [System.StringComparison]::OrdinalIgnoreCase) -or $Target.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
    throw "Refusing to clean a path outside the repo: $Target"
  }
}

function Get-DirectoryStats {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{
      files = 0
      megabytes = 0
    }
  }

  $measure = Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum
  return [pscustomobject]@{
    files = $measure.Count
    megabytes = [math]::Round(($measure.Sum / 1MB), 1)
  }
}

function Get-NodeCommandLines {
  Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue |
    ForEach-Object {
      if ($_.CommandLine) {
        $_.CommandLine.Replace('\', '/').ToLowerInvariant()
      }
    }
}

function Test-AnyCommandLineMatch {
  param([string[]]$Patterns)

  $commandLines = @(Get-NodeCommandLines)
  foreach ($commandLine in $commandLines) {
    foreach ($pattern in $Patterns) {
      if ($commandLine -match $pattern) {
        return $true
      }
    }
  }

  return $false
}

function Invoke-CleanTarget {
  param(
    [string]$Label,
    [string]$RelativePath,
    [string[]]$ActiveProcessPatterns
  )

  $target = Resolve-TargetPath -Root $resolvedRepoRoot -RelativePath $RelativePath
  Assert-PathInsideRepo -Root $resolvedRepoRoot -Target $target

  $stats = Get-DirectoryStats -Path $target
  $active = Test-AnyCommandLineMatch -Patterns $ActiveProcessPatterns

  if (-not (Test-Path -LiteralPath $target)) {
    Write-Host "MISSING $Label ($RelativePath)"
    return
  }

  if ($active -and -not $Force) {
    Write-Host "SKIP    $Label ($RelativePath): $($stats.files) files, $($stats.megabytes) MB; active Node process detected"
    return
  }

  if ($DryRun) {
    Write-Host "DRYRUN  $Label ($RelativePath): $($stats.files) files, $($stats.megabytes) MB"
    return
  }

  Remove-Item -LiteralPath $target -Recurse -Force
  Write-Host "REMOVED $Label ($RelativePath): $($stats.files) files, $($stats.megabytes) MB"
}

$resolvedRepoRoot = Normalize-PathForCompare -Path (Resolve-Path -LiteralPath $RepoRoot).Path

$adminPatterns = @(
  "next/dist/server/lib/start-server\.js",
  "next/dist/bin/next.*dev"
)

$apiPatterns = @(
  "dist/main\.js"
)

if ($IncludeNextBuild) {
  Invoke-CleanTarget -Label "Admin Next build and dev artifacts" -RelativePath "apps\admin_web\.next" -ActiveProcessPatterns $adminPatterns
} else {
  Invoke-CleanTarget -Label "Admin Next dev artifacts" -RelativePath "apps\admin_web\.next\dev" -ActiveProcessPatterns $adminPatterns
  Invoke-CleanTarget -Label "Admin Next cache artifacts" -RelativePath "apps\admin_web\.next\cache" -ActiveProcessPatterns $adminPatterns
}

Invoke-CleanTarget -Label "API build output" -RelativePath "apps\api\dist" -ActiveProcessPatterns $apiPatterns
