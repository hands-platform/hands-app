param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [string]$SecretRoot = "C:\dev\hands-secrets\firebase",
  [string]$DestinationFileName = "hands-vn-mvp-firebase-admin.json",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) {
    return (Resolve-Path -LiteralPath $Path).Path
  }

  return [System.IO.Path]::GetFullPath($Path)
}

function Test-IsSubPath {
  param(
    [string]$ParentPath,
    [string]$ChildPath
  )

  $parent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $child = [System.IO.Path]::GetFullPath($ChildPath)
  return $child.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-HasJsonProperty {
  param(
    [object]$Json,
    [string]$Name
  )

  return $Json.PSObject.Properties.Name -contains $Name
}

function Assert-ServiceAccountJson {
  param([string]$Path)

  $raw = Get-Content -Raw -LiteralPath $Path
  try {
    $json = $raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "Source file is not valid JSON."
  }

  if (-not (Test-HasJsonProperty -Json $json -Name "type") -or $json.type -ne "service_account") {
    throw "Source JSON must have type=service_account."
  }

  foreach ($key in @("project_id", "client_email", "private_key")) {
    if (-not (Test-HasJsonProperty -Json $json -Name $key) -or [string]::IsNullOrWhiteSpace([string]$json.$key)) {
      throw "Source JSON is missing required Firebase Admin field: $key."
    }
  }
}

$repoRoot = Resolve-FullPath (Join-Path $PSScriptRoot "..\..")
$sourceFullPath = Resolve-FullPath $SourcePath

if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
  throw "SourcePath does not point to an existing file: $sourceFullPath"
}

Assert-ServiceAccountJson -Path $sourceFullPath

if (-not (Test-Path -LiteralPath $SecretRoot)) {
  New-Item -ItemType Directory -Force -Path $SecretRoot | Out-Null
}

$secretRootFullPath = Resolve-FullPath $SecretRoot
$destinationPath = Join-Path $secretRootFullPath $DestinationFileName
$destinationFullPath = [System.IO.Path]::GetFullPath($destinationPath)

if (Test-IsSubPath -ParentPath $repoRoot -ChildPath $destinationFullPath) {
  throw "Destination must stay outside the Git workspace. Use a path under C:\dev\hands-secrets or another private folder."
}

if ((Test-Path -LiteralPath $destinationFullPath) -and -not $Force) {
  throw "Destination already exists. Re-run with -Force to overwrite: $destinationFullPath"
}

if ($sourceFullPath -ne $destinationFullPath) {
  Copy-Item -LiteralPath $sourceFullPath -Destination $destinationFullPath -Force:$Force
}

Assert-ServiceAccountJson -Path $destinationFullPath

$summary = [ordered]@{
  ok = $true
  destination = $destinationFullPath
  env = [ordered]@{
    PUSH_PROVIDER = "fcm"
    GOOGLE_APPLICATION_CREDENTIALS = $destinationFullPath
  }
  nextCommands = @(
    "npm.cmd run fcm:credentials-check -- --env=.env",
    "npm.cmd run external:check:push",
    "npm.cmd run fcm:push-smoke -- --dry-run"
  )
}

$summary | ConvertTo-Json -Depth 4
