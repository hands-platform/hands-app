param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [string]$SecretRoot = "C:\dev\hands-secrets\firebase",
  [string]$DestinationFileName = "hands-vn-mvp-firebase-admin.json",
  [string]$DockerContainerCredentialsPath = "/run/secrets/firebase-admin.json",
  [string]$EnvFile = ".env",
  [switch]$UpdateEnv,
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

function ConvertTo-EnvValue {
  param([string]$Value)

  if ($Value -match '[\s#]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }

  return $Value
}

function ConvertTo-CommandArgument {
  param([string]$Value)

  if ($Value -notmatch '[\s"]') {
    return $Value
  }

  return '"' + ($Value -replace '"', '\"') + '"'
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Set-EnvValue {
  param(
    [string[]]$Lines,
    [string]$Key,
    [string]$Value
  )

  $pattern = "^\s*$([System.Text.RegularExpressions.Regex]::Escape($Key))\s*="
  $replacement = "$Key=$(ConvertTo-EnvValue -Value $Value)"
  $updated = $false
  $nextLines = New-Object System.Collections.Generic.List[string]

  foreach ($line in $Lines) {
    if ($line -match $pattern) {
      if (-not $updated) {
        $nextLines.Add($replacement)
        $updated = $true
      }
      continue
    }

    $nextLines.Add($line)
  }

  if (-not $updated) {
    if ($nextLines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($nextLines[$nextLines.Count - 1])) {
      $nextLines.Add("")
    }
    $nextLines.Add($replacement)
  }

  return $nextLines.ToArray()
}

function Update-EnvFile {
  param(
    [string]$Path,
    [string]$GoogleApplicationCredentials,
    [string]$DockerContainerCredentialsPath
  )

  $lines = @()
  if (Test-Path -LiteralPath $Path) {
    $lines = Get-Content -LiteralPath $Path
  }

  $lines = Set-EnvValue -Lines $lines -Key "PUSH_PROVIDER" -Value "fcm"
  $lines = Set-EnvValue -Lines $lines -Key "GOOGLE_APPLICATION_CREDENTIALS" -Value $GoogleApplicationCredentials
  $lines = Set-EnvValue -Lines $lines -Key "FIREBASE_ADMIN_CREDENTIALS_HOST_PATH" -Value $GoogleApplicationCredentials
  $lines = Set-EnvValue -Lines $lines -Key "FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH" -Value $DockerContainerCredentialsPath
  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  Write-Utf8NoBom -Path $Path -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

$repoRoot = Resolve-FullPath (Join-Path $PSScriptRoot "..\..")
$sourceFullPath = Resolve-FullPath $SourcePath

if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
  throw "SourcePath does not point to an existing file: $sourceFullPath"
}

Assert-ServiceAccountJson -Path $sourceFullPath

$secretRootFullPath = Resolve-FullPath $SecretRoot
$destinationPath = Join-Path $secretRootFullPath $DestinationFileName
$destinationFullPath = [System.IO.Path]::GetFullPath($destinationPath)

if (Test-IsSubPath -ParentPath $repoRoot -ChildPath $destinationFullPath) {
  throw "Destination must stay outside the Git workspace. Use a path under C:\dev\hands-secrets or another private folder."
}

if (-not (Test-Path -LiteralPath $secretRootFullPath)) {
  New-Item -ItemType Directory -Force -Path $secretRootFullPath | Out-Null
}

if ((Test-Path -LiteralPath $destinationFullPath) -and -not $Force) {
  throw "Destination already exists. Re-run with -Force to overwrite: $destinationFullPath"
}

if ($sourceFullPath -ne $destinationFullPath) {
  Copy-Item -LiteralPath $sourceFullPath -Destination $destinationFullPath -Force:$Force
}

Assert-ServiceAccountJson -Path $destinationFullPath

$envFileFullPath = $null
if ($UpdateEnv) {
  $envFileFullPath = Resolve-FullPath $EnvFile
  Update-EnvFile `
    -Path $envFileFullPath `
    -GoogleApplicationCredentials $destinationFullPath `
    -DockerContainerCredentialsPath $DockerContainerCredentialsPath
}

$defaultEnvFilePath = Resolve-FullPath ".env"
$customEnvFile = $UpdateEnv -and $envFileFullPath -ne $defaultEnvFilePath
$customEnvArg = if ($customEnvFile) { ConvertTo-CommandArgument -Value $envFileFullPath } else { $null }
$envCommandSuffix = if ($customEnvFile) { " -- --env=$customEnvArg" } else { "" }
$pushSmokeEnvArg = if ($customEnvFile) { " --env=$customEnvArg" } else { "" }

$summary = [ordered]@{
  ok = $true
  destination = $destinationFullPath
  envFile = $envFileFullPath
  env = [ordered]@{
    PUSH_PROVIDER = "fcm"
    GOOGLE_APPLICATION_CREDENTIALS = $destinationFullPath
    FIREBASE_ADMIN_CREDENTIALS_HOST_PATH = $destinationFullPath
    FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH = $DockerContainerCredentialsPath
  }
  nextCommands = @(
    "npm.cmd run fcm:credentials-check$envCommandSuffix",
    "npm.cmd run docker:contract",
    "npm.cmd run external:check:push$envCommandSuffix",
    "npm.cmd run fcm:push-smoke -- --dry-run$pushSmokeEnvArg"
  )
}

$summary | ConvertTo-Json -Depth 4
