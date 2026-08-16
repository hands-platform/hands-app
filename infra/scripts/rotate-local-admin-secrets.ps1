param(
  [string]$RepoRoot = "C:\dev\massage-on-demand-vn",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$envPath = Join-Path $RepoRoot ".env"
$secretKeys = @(
  "ADMIN_MFA_ENCRYPTION_KEY",
  "ADMIN_WEB_API_TOKEN_SECRET",
  "ADMIN_REALTIME_TOKEN_SECRET",
  "ADMIN_WEB_SESSION_COOKIE_SECRET"
)

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Local .env was not found at $envPath."
}

function New-LocalSecret {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Test-UsableSecret {
  param([string]$Value)

  $normalized = [string]$Value
  return $normalized.Length -ge 32 -and $normalized -notmatch '^(change-me|dev-|local-|test-|placeholder)'
}

$content = [System.IO.File]::ReadAllText($envPath)
$updatedKeys = @()
$preservedKeys = @()

foreach ($key in $secretKeys) {
  $pattern = "(?m)^$([Regex]::Escape($key))=(.*)$"
  $match = [Regex]::Match($content, $pattern)
  $existingValue = if ($match.Success) { $match.Groups[1].Value.Trim().Trim('"').Trim("'") } else { "" }

  if (-not $Force -and (Test-UsableSecret -Value $existingValue)) {
    $preservedKeys += $key
    continue
  }

  $replacement = "$key=$(New-LocalSecret)"
  if ($match.Success) {
    $content = [Regex]::Replace($content, $pattern, $replacement, 1)
  } else {
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
      $content += [Environment]::NewLine
    }
    $content += $replacement + [Environment]::NewLine
  }
  $updatedKeys += $key
}

$tempPath = "$envPath.tmp"
$encoding = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempPath, $content, $encoding)
Move-Item -LiteralPath $tempPath -Destination $envPath -Force

[pscustomobject]@{
  envPath = $envPath
  updated = $updatedKeys
  preserved = $preservedKeys
  valuesPrinted = $false
  note = "These are local-only secrets. Provision separate production secrets in the deployment secret manager."
} | ConvertTo-Json -Depth 3
